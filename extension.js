const path = require('path');
const { loadData } = require('./src/utils/dataLoader');
const { createCustomFieldStore, getCustomFieldsConfigPath } = require('./src/utils/customFields');
const { getWorkspaceFolders } = require('./src/utils/workspace');
const { discoverFieldIds } = require('./src/sdf/sdfIndex');
const { createCompletionProvider } = require('./src/providers/completionProvider');
const { createSuiteQLCompletionProvider } = require('./src/providers/suiteqlCompletionProvider');
const { createHoverProvider } = require('./src/providers/hoverProvider');
const { createDiagnosticProvider } = require('./src/providers/diagnosticProvider');
const { checkAndPromptForRating } = require('./src/services/ratingPrompt');
const { registerCommands, OUTPUT_CHANNEL_NAME } = require('./src/commands/registerCommands');
const { registerLanguageModelTools } = require('./src/ai/lmTools');
const { createStatusBar } = require('./src/services/statusBar');

function activate(context) {
    const vscode = require('vscode');
    const extensionPath = context.extensionPath;
    const data = loadData(extensionPath);
    const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);

    const customFieldStore = createCustomFieldStore(vscode, {
        discoverIds: (folderPath) => {
            try {
                const { findProjectRootFromPath } = require('./src/services/suitecloudRunner');
                const root = findProjectRootFromPath(folderPath, folderPath);
                return root ? discoverFieldIds(root) : [];
            } catch {
                return [];
            }
        }
    });

    const services = {
        data,
        extensionPath,
        context,
        outputChannel,
        customFieldStore
    };

    context.subscriptions.push(
        outputChannel,
        createCompletionProvider(vscode, data, customFieldStore),
        createSuiteQLCompletionProvider(vscode, data),
        createHoverProvider(vscode, data),
        ...createDiagnosticProvider(vscode, data),
        ...registerLanguageModelTools(vscode, context, services)
    );

    registerCommands(vscode, context, services);
    createStatusBar(vscode, context);
    watchWorkspaceConfig(vscode, context, customFieldStore);

    customFieldStore.reload();

    checkAndPromptForRating(
        vscode,
        context,
        context.extension.packageJSON.version
    ).catch((error) => {
        console.error('Unable to evaluate the NetSuite extension rating prompt.', error);
    });
}

function watchWorkspaceConfig(vscode, context, customFieldStore) {
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('netsuite')) {
                customFieldStore.reload();
            }
        })
    );

    for (const folder of getWorkspaceFolders(vscode)) {
        const pattern = new vscode.RelativePattern(folder, '**/*netsuite-fields.json');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const refresh = () => customFieldStore.reload();
        watcher.onDidChange(refresh);
        watcher.onDidCreate(refresh);
        watcher.onDidDelete(refresh);
        context.subscriptions.push(watcher);

        const schemaPattern = new vscode.RelativePattern(folder, '**/*netsuite-suiteql-schema.json');
        const schemaWatcher = vscode.workspace.createFileSystemWatcher(schemaPattern);
        schemaWatcher.onDidChange(() => {});
        schemaWatcher.onDidCreate(() => {});
        schemaWatcher.onDidDelete(() => {});
        context.subscriptions.push(schemaWatcher);
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
