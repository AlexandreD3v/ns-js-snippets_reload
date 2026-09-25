const { buildContext } = require('../ai/contextBuilder');
const { runSuiteCloudInTerminal } = require('../services/suitecloudRunner');
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

function configureDeveloperAssistant(vscode, services) {
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
        'Optional MCP: set NS_MCP_WORKSPACE to your project root, then run "node mcp/server.js" from this extension folder.'
    ].join('\n');

    runSuiteCloudInTerminal(vscode, {
        root: folder.uri.fsPath,
        args: ['proxy:generatekey'],
        name: 'SuiteCloud Assistant'
    });

    vscode.window.showInformationMessage('Developer Assistant setup started in terminal. See NetSuite output for proxy URL.');
    services.outputChannel.appendLine(instructions);
    services.outputChannel.show(true);
}

module.exports = {
    getAiCommands
};
