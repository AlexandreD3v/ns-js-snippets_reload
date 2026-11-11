const fs = require('fs');
const path = require('path');

// SuiteCloud CLI for Node.js writes the project's auth alias to project.json
// at the SuiteCloud project root (next to suitecloud.config.js):
//   { "defaultAuthId": "myAuthId" }
// The alias is chosen by the user in `account:setup`. The real account id,
// role and tokens live in the encrypted credentials file under
// ~/.suitecloud-sdk/ (credentials_browser_based.p12 or credentials_ci.p12)
// and are not read here.
const AUTH_ID_PROPERTY = 'defaultAuthId';

// NetSuite account ids:
//   production:       1234567 or TSTDRV1234567
//   sandbox:          1234567_SB1 (also _SB, _SB2, ...). URL form uses 1234567-sb1
//   release preview:  1234567_RP (URL form 1234567-rp)
// The project's authId is only an alias, so the same suffixes are applied to it.
const ACCOUNT_SUFFIX = /(?:^|[^A-Za-z0-9])[A-Za-z0-9]*[_-](sb|rp)\d*(?=$|[^A-Za-z0-9])/i;
const PRODUCTION_ACCOUNT_ID = /^(?:[A-Za-z]{2,})?\d{4,}$/;

const TOKEN_GROUPS = [
    { kind: 'sandbox', tokens: ['sandbox', 'sandboxes', 'sbx'] },
    { kind: 'release-preview', tokens: ['releasepreview', 'release-preview'] },
    { kind: 'production', tokens: ['prod', 'production', 'live', 'prd'] },
    { kind: 'non-production', tokens: ['dev', 'development', 'qa', 'uat', 'staging', 'nonprod', 'non-prod'] }
];

function tokensOf(value) {
    return String(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}

function hasToken(value, expected) {
    const tokens = tokensOf(value);
    const tokenSet = new Set(tokens);
    return expected.some((token) => {
        const needle = token.toLowerCase();
        if (tokenSet.has(needle)) {
            return true;
        }
        const parts = needle.split(/[^a-z0-9]+/).filter(Boolean);
        if (parts.length < 2) {
            return false;
        }
        for (let index = 0; index <= tokens.length - parts.length; index += 1) {
            if (parts.every((part, offset) => tokens[index + offset] === part)) {
                return true;
            }
        }
        return false;
    });
}

function classifyAccount(authId) {
    const value = typeof authId === 'string' ? authId.trim() : '';
    if (!value) {
        return { kind: 'unknown', authId: null, reason: 'missing' };
    }

    const suffix = value.match(ACCOUNT_SUFFIX);
    if (suffix) {
        const marker = suffix[1].toLowerCase();
        return {
            kind: marker === 'rp' ? 'release-preview' : 'sandbox',
            authId: value,
            reason: 'account-suffix'
        };
    }

    if (hasToken(value, ['nonprod', 'non-prod'])) {
        return { kind: 'non-production', authId: value, reason: 'name' };
    }

    for (const group of TOKEN_GROUPS) {
        if (hasToken(value, group.tokens)) {
            return { kind: group.kind, authId: value, reason: 'name' };
        }
    }

    if (PRODUCTION_ACCOUNT_ID.test(value) && !/^sb\d+$/i.test(value) && !/^rp\d+$/i.test(value)) {
        return { kind: 'production', authId: value, reason: 'account-id' };
    }

    return { kind: 'unknown', authId: value, reason: 'unclassified' };
}

function readProjectAuth(projectRoot, fileSystem = fs) {
    const filePath = path.join(projectRoot, 'project.json');
    if (!fileSystem.existsSync(filePath)) {
        return { authId: null, filePath, status: 'missing', environment: classifyAccount(null) };
    }

    let raw;
    try {
        raw = fileSystem.readFileSync(filePath, 'utf8');
    } catch (error) {
        return {
            authId: null,
            filePath,
            status: 'unreadable',
            error,
            environment: classifyAccount(null)
        };
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { authId: null, filePath, status: 'invalid', environment: classifyAccount(null) };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { authId: null, filePath, status: 'invalid', environment: classifyAccount(null) };
    }

    const authId = typeof parsed[AUTH_ID_PROPERTY] === 'string' ? parsed[AUTH_ID_PROPERTY].trim() : '';
    if (!authId) {
        return { authId: null, filePath, status: 'empty', environment: classifyAccount(null) };
    }

    return {
        authId,
        filePath,
        status: 'ok',
        environment: classifyAccount(authId)
    };
}

function shouldConfirmAccount(kind, alwaysConfirm) {
    if (kind === 'production') {
        return { confirm: true, strong: true };
    }
    if (kind === 'sandbox' || kind === 'release-preview' || kind === 'non-production') {
        return { confirm: Boolean(alwaysConfirm), strong: false };
    }
    return { confirm: true, strong: false };
}

function displayAuthId(authId) {
    return String(authId).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 120);
}

function environmentPhrase(kind) {
    switch (kind) {
        case 'sandbox':
            return 'sandbox';
        case 'release-preview':
            return 'release preview';
        case 'non-production':
            return 'non-production';
        case 'production':
            return 'production';
        default:
            return 'unknown';
    }
}

function buildAccountPrompt({ action, auth, alwaysConfirm }) {
    const verb = action === 'upload' ? 'Upload' : 'Deploy';
    const kind = auth && auth.environment ? auth.environment.kind : 'unknown';
    const decision = shouldConfirmAccount(kind, alwaysConfirm);
    if (!decision.confirm) {
        return null;
    }

    const confirmLabel = decision.strong ? `${verb} to production` : verb;
    const shown = auth && auth.authId ? displayAuthId(auth.authId) : '';
    let message;
    let detail;

    if (decision.strong) {
        message = `${verb} to PRODUCTION account "${shown}"? This updates the live NetSuite account.`;
        detail = 'The auth ID is defaultAuthId in project.json. Sandbox account IDs end with _SB, _SB1, _SB2, and so on. Release preview accounts end with _RP.';
    } else if (auth && auth.status === 'ok' && shown) {
        if (kind === 'unknown') {
            message = `${verb} to SuiteCloud account "${shown}"? The account type was not identified as sandbox.`;
            detail = 'This is defaultAuthId from project.json. Names or account IDs ending in _SB or _RP are treated as sandbox or release preview.';
        } else {
            message = `${verb} to SuiteCloud account "${shown}" (${environmentPhrase(kind)})?`;
            detail = 'This is defaultAuthId from project.json. SuiteCloud will use this authentication ID.';
        }
    } else if (auth && auth.status === 'invalid') {
        message = `${verb} when project.json could not be read? The SuiteCloud auth ID is unknown.`;
        detail = 'project.json should contain defaultAuthId. Fix the file or run SuiteCloud: Account Setup before continuing.';
    } else {
        message = `${verb} when no SuiteCloud auth ID is set in project.json?`;
        detail = 'The CLI may use whatever credentials it has configured. Run SuiteCloud: Account Setup so project.json contains defaultAuthId.';
    }

    return {
        message,
        detail,
        confirmLabel,
        strong: decision.strong,
        kind
    };
}

function fileCabinetArgument(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized === '.' || normalized.split('/').includes('..')) {
        return null;
    }
    return `/${normalized}`;
}

function interpretValidationResult(result) {
    if (!result || result.cliMissing || result.cancelled) {
        return 'stop';
    }
    if (result.exitCode === 0) {
        return 'continue';
    }
    if (typeof result.exitCode !== 'number' || result.exitCode < 0) {
        return 'stop';
    }
    return 'ask';
}

module.exports = {
    AUTH_ID_PROPERTY,
    classifyAccount,
    readProjectAuth,
    shouldConfirmAccount,
    displayAuthId,
    buildAccountPrompt,
    fileCabinetArgument,
    interpretValidationResult
};
