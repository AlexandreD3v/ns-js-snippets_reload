'use strict';

const fs = require('fs');
const path = require('path');

const EXTENSION_ID = 'alexandrejcorrea.ns-js-snippets-reload';
const results = [];
const rejections = [];

process.on('unhandledRejection', (reason) => {
    rejections.push(reason instanceof Error ? (reason.stack || reason.message) : String(reason));
});

function record(feature, status, detail) {
    results.push({
        feature,
        status,
        detail: detail || ''
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function workspacePath(vscode) {
    const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
    if (!folder) {
        throw new Error('O VS Code de teste não abriu a pasta de trabalho.');
    }
    return folder.uri.fsPath;
}

function clearFakeLog() {
    const logFile = process.env.NS_FAKE_SUITECLOUD_LOG;
    if (logFile) {
        fs.writeFileSync(logFile, '');
    }
}

function removeSuiteCloudProject(root) {
    fs.rmSync(path.join(root, 'suitecloud.config.js'), { force: true });
    fs.rmSync(path.join(root, 'src'), { recursive: true, force: true });
}

async function closeEditors(vscode) {
    await vscode.workspace.saveAll(false);
    for (let attempt = 0; attempt < 6; attempt++) {
        const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);
        if (tabs.length === 0) {
            return;
        }
        const clean = tabs.filter((tab) => !tab.isDirty);
        if (clean.length === 0) {
            const labels = tabs.map((tab) => `${tab.label}${tab.isDirty ? ' (sujo)' : ''}`).join(', ');
            throw new Error(`Editores sujos impediram fechar a janela: ${labels}`);
        }
        await vscode.window.tabGroups.close(clean);
    }
    if (vscode.window.activeTextEditor || vscode.window.tabGroups.all.some((group) => group.tabs.length > 0)) {
        throw new Error('Ainda há editores abertos depois de tentar fechá-los.');
    }
}

function messageText(calls) {
    return calls.map((call) => `${call.kind}: ${call.text}`).join(' | ');
}

function installUiHarness(vscode) {
    const calls = [];
    const opened = [];
    const restorers = [];
    let quickPickResponse;
    let inputResponse;
    let messageResponse;

    function replace(object, method, fn) {
        const original = object[method];
        object[method] = fn;
        if (object[method] !== fn) {
            throw new Error(`Não foi possível substituir vscode ${method}.`);
        }
        restorers.push(() => {
            object[method] = original;
        });
    }

    function note(kind, text) {
        calls.push({ kind, text: String(text || '') });
    }

    replace(vscode.window, 'showInformationMessage', async (text) => {
        note('info', text);
        return messageResponse;
    });
    replace(vscode.window, 'showWarningMessage', async (text) => {
        note('warning', text);
        return messageResponse;
    });
    replace(vscode.window, 'showErrorMessage', async (text) => {
        note('error', text);
        return messageResponse;
    });
    replace(vscode.window, 'showQuickPick', async (items, options) => {
        const resolved = items && typeof items.then === 'function' ? await items : items;
        note('quickPick', options && options.placeHolder);
        return typeof quickPickResponse === 'function'
            ? quickPickResponse(resolved, options)
            : quickPickResponse;
    });
    replace(vscode.window, 'showInputBox', async (options) => {
        note('input', options && (options.prompt || options.placeHolder));
        return typeof inputResponse === 'function' ? inputResponse(options) : inputResponse;
    });
    replace(vscode.window, 'showWorkspaceFolderPick', async (options) => {
        note('folder', options && options.placeHolder);
        return undefined;
    });
    replace(vscode.window, 'showOpenDialog', async () => {
        note('openDialog', '');
        return undefined;
    });
    replace(vscode.window, 'showSaveDialog', async () => {
        note('saveDialog', '');
        return undefined;
    });
    replace(vscode.env, 'openExternal', async (uri) => {
        const value = uri && uri.scheme
            ? `${uri.scheme}://${uri.authority || ''}${uri.path || ''}?${uri.query || ''}`
            : String(uri);
        opened.push(value);
        note('openExternal', value);
        return true;
    });

    return {
        calls,
        opened,
        setQuickPick(value) {
            quickPickResponse = value;
        },
        setInput(value) {
            inputResponse = value;
        },
        setMessage(value) {
            messageResponse = value;
        },
        reset() {
            calls.length = 0;
            opened.length = 0;
            quickPickResponse = undefined;
            inputResponse = undefined;
            messageResponse = undefined;
        },
        restore() {
            while (restorers.length > 0) {
                restorers.pop()();
            }
        }
    };
}

async function invokeCommand(vscode, command) {
    try {
        await vscode.commands.executeCommand(command);
        return null;
    } catch (error) {
        return error;
    }
}

function commandFailure(calls) {
    return calls.find((call) => call.kind === 'error' && call.text.startsWith('NetSuite command failed'));
}

async function check(feature, fn) {
    try {
        const detail = await fn();
        record(feature, 'passou', detail || '');
        return detail;
    } catch (error) {
        record(feature, 'falhou', error && error.message ? error.message : String(error));
        throw error;
    }
}

function flushReport() {
    const reportPath = process.env.NS_INTEGRATION_REPORT;
    if (!reportPath) {
        return;
    }
    const payload = {
        extensionId: EXTENSION_ID,
        generatedAt: new Date().toISOString(),
        unhandledRejections: rejections.slice(),
        results
    };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`\nINTEGRATION_REPORT ${reportPath}`);
}

function assertNoUnhandledRejections() {
    if (rejections.length > 0) {
        throw new Error(`Rejeições não tratadas durante os testes:\n${rejections.join('\n')}`);
    }
}

module.exports = {
    EXTENSION_ID,
    record,
    sleep,
    workspacePath,
    clearFakeLog,
    removeSuiteCloudProject,
    closeEditors,
    messageText,
    installUiHarness,
    invokeCommand,
    commandFailure,
    check,
    flushReport,
    assertNoUnhandledRejections,
    rejections
};
