const { buildContext } = require('../ai/contextBuilder');
const { runInteractiveSuiteCloud } = require('../services/suitecloudRunner');
const { getWorkspaceFolders } = require('../utils/workspace');

function getAiCommands(vscode, services) {
    return {
        'netsuite.copyAiContext': () => copyAiContext(vscode, services),
        'netsuite.configureDeveloperAssistant': () => configureDeveloperAssistant(vscode, services)
    };
}

async function copyAiContext(vscode, services) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Open a SuiteScript or SuiteQL file first.');
        return;
    }

    const includeContent = await vscode.window.showQuickPick(
        [
            { label: 'Metadata only (recommended)', value: false },
            { label: 'Include active file content', value: true }
        ],
        { placeHolder: 'Choose AI context payload' }
    );
    if (!includeContent) {
        return;
    }

    const payload = buildContext(vscode, editor.document, services.data, {
        includeFileContent: includeContent.value,
        customFieldStore: services.customFieldStore
    });

    await vscode.env.clipboard.writeText(JSON.stringify(payload, null, 2));
    vscode.window.showInformationMessage('NetSuite AI context copied to clipboard.');
}

async function configureDeveloperAssistant(vscode, services) {
    const folder = getWorkspaceFolders(vscode)[0];
    if (!folder) {
        vscode.window.showWarningMessage('Open a workspace folder first.');
        return;
    }

    const instructions = [
        'SuiteCloud Developer Assistant setup:',
        '1. Install Oracle SuiteCloud Extension for VS Code and enable Developer Assistant in workspace settings.',
        '2. Run: suitecloud proxy:generatekey',
        '3. Run: suitecloud proxy:start',
        '4. Configure your AI client (Cline/Cursor/Copilot-compatible) with the local OpenAI-compatible base URL and model ID from SuiteCloud output.',
        '5. Paste the generated API key into the client when prompted. This extension does not store the key.',
        '',
        'MCP: VS Code 1.101+ registers the local NetSuite SuiteScript server. Other clients can run "node mcp/server.js" from this extension folder. Tools are read-only and do not call a NetSuite account.'
    ].join('\n');

    services.outputChannel.appendLine(instructions);
    services.outputChannel.show(true);
    const terminal = await runInteractiveSuiteCloud(vscode, services.outputChannel, {
        root: folder.uri.fsPath,
        args: ['proxy:generatekey'],
        name: 'SuiteCloud Assistant',
        title: 'Developer Assistant key generation',
        notify: false
    });
    if (!terminal) {
        return;
    }
    vscode.window.showInformationMessage('Developer Assistant key generation is running in the integrated terminal. Setup steps are in the NetSuite SuiteScript output. This extension does not store the API key.');
}

module.exports = {
    getAiCommands
};
