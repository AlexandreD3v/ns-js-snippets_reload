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

function majorOf(version) {
    const [major] = String(version || '').split('.');
    return major || String(version || '');
}

function samePromptCohort(left, right) {
    if (!left || !right) {
        return false;
    }
    return majorOf(left) === majorOf(right);
}

function rememberedPromptVersion(value) {
    // Older builds stored the full version before the notification resolved, which
    // blocked that release even when the user never answered. Only a major version
    // recorded after a response counts.
    if (value == null || String(value).includes('.')) {
        return undefined;
    }
    return String(value);
}

function isRatingPromptEnabled(vscode, context) {
    if (!vscode.ExtensionMode || context.extensionMode == null) {
        return true;
    }
    return context.extensionMode !== vscode.ExtensionMode.Test;
}

async function checkAndPromptForRating(vscode, context, currentVersion, now = Date.now(), options = {}) {
    const force = Boolean(options.force);
    const persist = options.persist !== false;
    if (!currentVersion) {
        return false;
    }
    if (!force && !isRatingPromptEnabled(vscode, context)) {
        return false;
    }

    const state = context.globalState;
    let eligibility = null;
    if (!force && persist) {
        eligibility = await trackUsage(state, currentVersion, now);
        if (!shouldPromptForRating(eligibility)) {
            return false;
        }
    }

    const selection = await vscode.window.showInformationMessage(
        'Enjoying NetSuite JS Snippets Reload? A quick Marketplace rating helps other NetSuite developers find it.',
        'Rate now',
        'Later',
        "Don't ask again"
    );

    if (!persist) {
        if (selection === 'Rate now') {
            await vscode.env.openExternal(vscode.Uri.parse(MARKETPLACE_REVIEW_URL));
        }
        return true;
    }

    const promptedAt = eligibility?.now ?? now;
    await state.update(STATE_KEYS.promptedVersion, majorOf(currentVersion));

    if (selection === 'Rate now') {
        await state.update(STATE_KEYS.rated, true);
        await vscode.env.openExternal(vscode.Uri.parse(MARKETPLACE_REVIEW_URL));
        return true;
    }

    if (selection === "Don't ask again") {
        await state.update(STATE_KEYS.neverAsk, true);
        return true;
    }

    await state.update(STATE_KEYS.snoozedUntil, promptedAt + SNOOZE_DURATION_MS);
    return true;
}

async function trackUsage(state, currentVersion, now) {
    const installedAt = state.get(STATE_KEYS.installedAt);
    const lastSeenVersion = state.get(STATE_KEYS.lastSeenVersion);
    if (!installedAt) {
        await state.update(STATE_KEYS.installedAt, now);
    }

    const majorChanged = Boolean(lastSeenVersion && !samePromptCohort(lastSeenVersion, currentVersion));
    let sessionsSinceVersion;
    if (!lastSeenVersion || majorChanged) {
        sessionsSinceVersion = 1;
        await state.update(STATE_KEYS.lastSeenVersion, currentVersion);
        if (majorChanged) {
            await state.update(STATE_KEYS.updatedVersion, majorOf(currentVersion));
        }
    } else {
        sessionsSinceVersion = state.get(STATE_KEYS.sessionsSinceVersion, 0) + 1;
        if (lastSeenVersion !== currentVersion) {
            await state.update(STATE_KEYS.lastSeenVersion, currentVersion);
        }
    }
    await state.update(STATE_KEYS.sessionsSinceVersion, sessionsSinceVersion);

    return {
        now,
        installedAt: installedAt || now,
        currentVersion,
        lastSeenVersion,
        sessionsSinceVersion,
        isUpdate: state.get(STATE_KEYS.updatedVersion) === majorOf(currentVersion),
        promptedVersion: state.get(STATE_KEYS.promptedVersion),
        snoozedUntil: state.get(STATE_KEYS.snoozedUntil, 0),
        rated: state.get(STATE_KEYS.rated, false),
        neverAsk: state.get(STATE_KEYS.neverAsk, false)
    };
}

function shouldPromptForRating(state) {
    if (state.rated || state.neverAsk) {
        return false;
    }

    if (state.snoozedUntil > state.now) {
        return false;
    }

    if (samePromptCohort(rememberedPromptVersion(state.promptedVersion), state.currentVersion)) {
        return false;
    }

    if (state.isUpdate) {
        return state.sessionsSinceVersion >= UPDATE_SESSIONS;
    }

    const oldEnough = state.now - state.installedAt >= FIRST_INSTALL_DELAY_MS;
    return oldEnough && state.sessionsSinceVersion >= FIRST_INSTALL_SESSIONS;
}

function getRatingCommands(vscode, services) {
    return {
        'netsuite.debugShowRatingPrompt': () => previewRatingPrompt(vscode, services)
    };
}

async function previewRatingPrompt(vscode, services) {
    const version = services.context.extension?.packageJSON?.version || '0.0.0';
    services.outputChannel.appendLine('Rating reminder preview. The answer is not saved.');
    try {
        await checkAndPromptForRating(vscode, services.context, version, Date.now(), {
            force: true,
            persist: false
        });
        services.outputChannel.appendLine('Rating reminder preview closed without changing saved preferences.');
    } catch (error) {
        services.outputChannel.appendLine(`[rating-prompt] ${error.stack || error.message}`);
        services.outputChannel.show(true);
        vscode.window.showErrorMessage(`Rating reminder preview failed: ${error.message}`);
    }
}

module.exports = {
    checkAndPromptForRating,
    shouldPromptForRating,
    getRatingCommands,
    majorOf,
    samePromptCohort,
    rememberedPromptVersion,
    isRatingPromptEnabled,
    STATE_KEYS,
    FIRST_INSTALL_DELAY_MS,
    SNOOZE_DURATION_MS,
    FIRST_INSTALL_SESSIONS,
    UPDATE_SESSIONS,
    MARKETPLACE_REVIEW_URL
};
