const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_INSTALL_DELAY_MS = 7 * DAY_MS;
const SNOOZE_DURATION_MS = 14 * DAY_MS;
const FIRST_INSTALL_SESSIONS = 5;
const UPDATE_SESSIONS = 2;
const MARKETPLACE_REVIEW_URL =
    'https://marketplace.visualstudio.com/items?itemName=alexandrejcorrea.ns-js-snippets-reload&ssr=false#review-details';

const STATE_KEYS = {
    installedAt: 'ratingPrompt.installedAt',
    lastSeenVersion: 'ratingPrompt.lastSeenVersion',
    updatedVersion: 'ratingPrompt.updatedVersion',
    sessionsSinceVersion: 'ratingPrompt.sessionsSinceVersion',
    promptedVersion: 'ratingPrompt.promptedVersion',
    snoozedUntil: 'ratingPrompt.snoozedUntil',
    rated: 'ratingPrompt.rated',
    neverAsk: 'ratingPrompt.neverAsk'
};

async function checkAndPromptForRating(vscode, context, currentVersion, now = Date.now()) {
    if (!isProductionMode(vscode, context) || !currentVersion) {
        return false;
    }

    const state = context.globalState;
    const installedAt = state.get(STATE_KEYS.installedAt);
    const lastSeenVersion = state.get(STATE_KEYS.lastSeenVersion);
    const isFirstTrackedSession = !installedAt;
    const versionChanged = Boolean(lastSeenVersion && lastSeenVersion !== currentVersion);

    if (isFirstTrackedSession) {
        await state.update(STATE_KEYS.installedAt, now);
    }

    let sessionsSinceVersion;
    if (!lastSeenVersion || versionChanged) {
        sessionsSinceVersion = 1;
        await state.update(STATE_KEYS.lastSeenVersion, currentVersion);
        if (versionChanged) {
            await state.update(STATE_KEYS.updatedVersion, currentVersion);
        }
    } else {
        sessionsSinceVersion = state.get(STATE_KEYS.sessionsSinceVersion, 0) + 1;
    }
    await state.update(STATE_KEYS.sessionsSinceVersion, sessionsSinceVersion);

    const isUpdate = state.get(STATE_KEYS.updatedVersion) === currentVersion;
    const eligibility = {
        now,
        installedAt: installedAt || now,
        currentVersion,
        lastSeenVersion,
        sessionsSinceVersion,
        isUpdate,
        promptedVersion: state.get(STATE_KEYS.promptedVersion),
        snoozedUntil: state.get(STATE_KEYS.snoozedUntil, 0),
        rated: state.get(STATE_KEYS.rated, false),
        neverAsk: state.get(STATE_KEYS.neverAsk, false)
    };

    if (!shouldPromptForRating(eligibility)) {
        return false;
    }

    await state.update(STATE_KEYS.promptedVersion, currentVersion);

    const selection = await vscode.window.showInformationMessage(
        'Enjoying NetSuite JS Snippets Reload? A quick Marketplace rating helps other NetSuite developers find it.',
        'Rate now',
        'Later',
        "Don't ask again"
    );

    if (selection === 'Rate now') {
        await state.update(STATE_KEYS.rated, true);
        await vscode.env.openExternal(vscode.Uri.parse(MARKETPLACE_REVIEW_URL));
        return true;
    }

    if (selection === "Don't ask again") {
        await state.update(STATE_KEYS.neverAsk, true);
        return true;
    }

    // Treat closing the notification like "Later" to avoid prompting again
    // during every VS Code session.
    await state.update(STATE_KEYS.snoozedUntil, now + SNOOZE_DURATION_MS);
    await state.update(STATE_KEYS.promptedVersion, undefined);
    return true;
}

function shouldPromptForRating(state) {
    if (state.rated || state.neverAsk) {
        return false;
    }

    if (state.snoozedUntil > state.now) {
        return false;
    }

    if (state.promptedVersion === state.currentVersion) {
        return false;
    }

    if (state.isUpdate) {
        return state.sessionsSinceVersion >= UPDATE_SESSIONS;
    }

    const oldEnough = state.now - state.installedAt >= FIRST_INSTALL_DELAY_MS;
    return oldEnough && state.sessionsSinceVersion >= FIRST_INSTALL_SESSIONS;
}

function isProductionMode(vscode, context) {
    return !vscode.ExtensionMode ||
        context.extensionMode === vscode.ExtensionMode.Production;
}

module.exports = {
    checkAndPromptForRating,
    shouldPromptForRating,
    STATE_KEYS,
    FIRST_INSTALL_DELAY_MS,
    SNOOZE_DURATION_MS,
    FIRST_INSTALL_SESSIONS,
    UPDATE_SESSIONS,
    MARKETPLACE_REVIEW_URL
};
