const { loadData } = require('./src/utils/dataLoader');
const { createCompletionProvider } = require('./src/providers/completionProvider');
const { createHoverProvider } = require('./src/providers/hoverProvider');
const { createDiagnosticProvider } = require('./src/providers/diagnosticProvider');
const { checkAndPromptForRating } = require('./src/services/ratingPrompt');

function activate(context) {
    const vscode = require('vscode');
    const extensionPath = context.extensionPath;
    const data = loadData(extensionPath);

    context.subscriptions.push(
        createCompletionProvider(vscode, data),
        createHoverProvider(vscode, data),
        ...createDiagnosticProvider(vscode, data)
    );

    checkAndPromptForRating(
        vscode,
        context,
        context.extension.packageJSON.version
    ).catch((error) => {
        console.error('Unable to evaluate the NetSuite extension rating prompt.', error);
    });
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
