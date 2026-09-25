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
        ExtensionMode: { Production: 1, Development: 2 },
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
        shouldPromptForRating(eligibleState({ snoozedUntil: FIRST_INSTALL_DELAY_MS + 1 })),
        false,
        'snooze should suppress prompts'
    );
    assert.strictEqual(shouldPromptForRating(eligibleState({ rated: true })), false);
    assert.strictEqual(shouldPromptForRating(eligibleState({ neverAsk: true })), false);

    const updateState = createGlobalState({
        [STATE_KEYS.installedAt]: 1,
        [STATE_KEYS.lastSeenVersion]: '0.2.0'
    });
    const updateVscode = createVscode('Rate now');
    const updateContext = { globalState: updateState, extensionMode: 1 };

    await checkAndPromptForRating(updateVscode, updateContext, '0.3.0', FIRST_INSTALL_DELAY_MS);
    assert.strictEqual(updateVscode.calls.prompts, 0, 'first updated session should not prompt');

    await checkAndPromptForRating(updateVscode, updateContext, '0.3.0', FIRST_INSTALL_DELAY_MS);
    assert.strictEqual(updateVscode.calls.prompts, 1, 'second updated session should prompt');
    assert.deepStrictEqual(updateVscode.calls.opened, [MARKETPLACE_REVIEW_URL]);
    assert.strictEqual(updateState.get(STATE_KEYS.rated), true);

    const laterState = createGlobalState({
        [STATE_KEYS.installedAt]: 1,
        [STATE_KEYS.lastSeenVersion]: '0.3.0',
        [STATE_KEYS.sessionsSinceVersion]: 4
    });
    const laterVscode = createVscode('Later');
    const eligibleNow = FIRST_INSTALL_DELAY_MS + 1;
    await checkAndPromptForRating(
        laterVscode,
        { globalState: laterState, extensionMode: 1 },
        '0.3.0',
        eligibleNow
    );
    assert.strictEqual(
        laterState.get(STATE_KEYS.snoozedUntil),
        eligibleNow + SNOOZE_DURATION_MS
    );

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
    assert.strictEqual(developmentState.values.size, 0, 'development mode should not write state');

    console.log('Rating prompt tests passed.');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
