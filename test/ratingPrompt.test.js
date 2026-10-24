const assert = require('assert');
const {
    checkAndPromptForRating,
    shouldPromptForRating,
    STATE_KEYS,
    FIRST_INSTALL_DELAY_MS,
    SNOOZE_DURATION_MS,
    MARKETPLACE_REVIEW_URL
} = require('../src/services/ratingPrompt');

function createGlobalState(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        get(key, defaultValue) {
            return values.has(key) ? values.get(key) : defaultValue;
        },
        async update(key, value) {
            if (value === undefined) {
                values.delete(key);
            } else {
                values.set(key, value);
            }
        },
        values
    };
}

function createVscode(selection = 'Later') {
    const calls = { prompts: 0, opened: [] };
    return {
        ExtensionMode: { Production: 1, Development: 2, Test: 3 },
        Uri: { parse: (value) => value },
        window: {
            async showInformationMessage() {
                calls.prompts += 1;
                return selection;
            }
        },
        env: {
            async openExternal(uri) {
                calls.opened.push(uri);
                return true;
            }
        },
        calls
    };
}

function eligibleState(overrides = {}) {
    return {
        now: FIRST_INSTALL_DELAY_MS,
        installedAt: 0,
        currentVersion: '0.3.0',
        lastSeenVersion: '0.3.0',
        sessionsSinceVersion: 5,
        isUpdate: false,
        promptedVersion: undefined,
        snoozedUntil: 0,
        rated: false,
        neverAsk: false,
        ...overrides
    };
}

async function run() {
    assert.strictEqual(shouldPromptForRating(eligibleState()), true, 'eligible install should prompt');
    assert.strictEqual(
        shouldPromptForRating(eligibleState({ now: FIRST_INSTALL_DELAY_MS - 1 })),
        false,
        'fresh install should wait seven days'
    );
    assert.strictEqual(
        shouldPromptForRating(eligibleState({ sessionsSinceVersion: 4 })),
        false,
        'fresh install should wait five sessions'
    );
    assert.strictEqual(
        shouldPromptForRating(eligibleState({ isUpdate: true, sessionsSinceVersion: 2 })),
        true,
        'updated version should prompt after two sessions'
    );
    assert.strictEqual(
        shouldPromptForRating(eligibleState({ promptedVersion: '0', currentVersion: '0.9.1' })),
        false,
        'minor and patch updates share the prompted major version'
    );
    assert.strictEqual(
        shouldPromptForRating(eligibleState({ promptedVersion: '0.7.0', currentVersion: '0.7.4' })),
        true,
        'a legacy full version saved before an answer does not keep blocking'
    );
    assert.strictEqual(
        shouldPromptForRating(eligibleState({
            promptedVersion: '0',
            currentVersion: '1.0.0',
            isUpdate: true,
            sessionsSinceVersion: 2
        })),
        true,
        'a new major version can prompt again'
    );
    assert.strictEqual(
        shouldPromptForRating(eligibleState({ snoozedUntil: FIRST_INSTALL_DELAY_MS + 1 })),
        false,
        'snooze should suppress prompts'
    );
    assert.strictEqual(shouldPromptForRating(eligibleState({ rated: true })), false);
    assert.strictEqual(shouldPromptForRating(eligibleState({ neverAsk: true })), false);

    const updateState = createGlobalState({
        [STATE_KEYS.installedAt]: 1,
        [STATE_KEYS.lastSeenVersion]: '0.9.0',
        [STATE_KEYS.sessionsSinceVersion]: 10,
        [STATE_KEYS.promptedVersion]: '0'
    });
    const updateVscode = createVscode('Rate now');
    const updateContext = { globalState: updateState, extensionMode: 1 };

    await checkAndPromptForRating(updateVscode, updateContext, '1.0.0', FIRST_INSTALL_DELAY_MS);
    assert.strictEqual(updateVscode.calls.prompts, 0, 'first session of a major update should not prompt');
    assert.strictEqual(updateState.get(STATE_KEYS.sessionsSinceVersion), 1);
    assert.strictEqual(updateState.get(STATE_KEYS.promptedVersion), '0');

    await checkAndPromptForRating(updateVscode, updateContext, '1.0.0', FIRST_INSTALL_DELAY_MS);
    assert.strictEqual(updateVscode.calls.prompts, 1, 'second session of a major update should prompt');
    assert.deepStrictEqual(updateVscode.calls.opened, [MARKETPLACE_REVIEW_URL]);
    assert.strictEqual(updateState.get(STATE_KEYS.rated), true);
    assert.strictEqual(updateState.get(STATE_KEYS.promptedVersion), '1');

    const laterState = createGlobalState({
        [STATE_KEYS.installedAt]: 1,
        [STATE_KEYS.lastSeenVersion]: '0.3.0',
        [STATE_KEYS.sessionsSinceVersion]: 4
    });
    const laterVscode = createVscode('Later');
    let promptedDuringDialog;
    laterVscode.window.showInformationMessage = async () => {
        laterVscode.calls.prompts += 1;
        promptedDuringDialog = laterState.get(STATE_KEYS.promptedVersion);
        return 'Later';
    };
    const eligibleNow = FIRST_INSTALL_DELAY_MS + 1;
    await checkAndPromptForRating(
        laterVscode,
        { globalState: laterState, extensionMode: 1 },
        '0.3.0',
        eligibleNow
    );
    assert.strictEqual(promptedDuringDialog, undefined, 'prompted version is recorded only after the dialog resolves');
    assert.strictEqual(laterState.get(STATE_KEYS.promptedVersion), '0');
    assert.strictEqual(
        laterState.get(STATE_KEYS.snoozedUntil),
        eligibleNow + SNOOZE_DURATION_MS
    );

    await checkAndPromptForRating(
        laterVscode,
        { globalState: laterState, extensionMode: 1 },
        '0.3.4',
        eligibleNow + SNOOZE_DURATION_MS + 1
    );
    assert.strictEqual(laterVscode.calls.prompts, 1, 'a patch bump does not ask again in the same major version');

    const neverState = createGlobalState({
        [STATE_KEYS.installedAt]: 1,
        [STATE_KEYS.lastSeenVersion]: '0.3.0',
        [STATE_KEYS.sessionsSinceVersion]: 4
    });
    const neverVscode = createVscode("Don't ask again");
    await checkAndPromptForRating(
        neverVscode,
        { globalState: neverState, extensionMode: 1 },
        '0.3.0',
        eligibleNow
    );
    assert.strictEqual(neverState.get(STATE_KEYS.neverAsk), true);

    const developmentState = createGlobalState();
    const developmentVscode = createVscode();
    await checkAndPromptForRating(
        developmentVscode,
        { globalState: developmentState, extensionMode: 2 },
        '0.3.0',
        FIRST_INSTALL_DELAY_MS
    );
    assert.ok(developmentState.get(STATE_KEYS.installedAt), 'development mode still tracks real usage');
    assert.strictEqual(developmentVscode.calls.prompts, 0, 'a fresh development session is not old enough to prompt');

    const testModeState = createGlobalState();
    const testModeVscode = createVscode();
    await checkAndPromptForRating(
        testModeVscode,
        { globalState: testModeState, extensionMode: 3 },
        '0.3.0',
        FIRST_INSTALL_DELAY_MS
    );
    assert.strictEqual(testModeState.values.size, 0, 'test mode should not write state');

    const minorState = createGlobalState({
        [STATE_KEYS.installedAt]: 1,
        [STATE_KEYS.lastSeenVersion]: '0.7.0',
        [STATE_KEYS.sessionsSinceVersion]: 3
    });
    const minorVscode = createVscode('Later');
    await checkAndPromptForRating(
        minorVscode,
        { globalState: minorState, extensionMode: 1 },
        '0.7.1',
        eligibleNow
    );
    assert.strictEqual(minorVscode.calls.prompts, 0);
    assert.strictEqual(minorState.get(STATE_KEYS.sessionsSinceVersion), 4, 'patch bumps keep the session count');
    assert.strictEqual(minorState.get(STATE_KEYS.updatedVersion), undefined);

    const throwState = createGlobalState({
        [STATE_KEYS.installedAt]: 1,
        [STATE_KEYS.lastSeenVersion]: '0.7.0',
        [STATE_KEYS.sessionsSinceVersion]: 4
    });
    const throwVscode = createVscode();
    throwVscode.window.showInformationMessage = async () => {
        throw new Error('notification failed');
    };
    await assert.rejects(
        () => checkAndPromptForRating(
            throwVscode,
            { globalState: throwState, extensionMode: 1 },
            '0.7.0',
            eligibleNow
        ),
        /notification failed/
    );
    assert.strictEqual(throwState.get(STATE_KEYS.promptedVersion), undefined);

    const previewState = createGlobalState();
    const previewVscode = createVscode('Rate now');
    await checkAndPromptForRating(
        previewVscode,
        { globalState: previewState, extensionMode: 3 },
        '0.7.0',
        0,
        { force: true, persist: false }
    );
    assert.strictEqual(previewVscode.calls.prompts, 1, 'the debug preview ignores eligibility and test mode');
    assert.strictEqual(previewState.values.size, 0, 'the debug preview does not save an answer');
    assert.deepStrictEqual(previewVscode.calls.opened, [MARKETPLACE_REVIEW_URL]);

    console.log('Rating prompt tests passed.');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
