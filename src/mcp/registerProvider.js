const path = require('path');
const { PROVIDER_ID, buildMcpLaunch } = require('./tools');

function registerMcpServerProvider(vscode, context, outputChannel) {
    if (!vscode.lm || typeof vscode.lm.registerMcpServerDefinitionProvider !== 'function' || typeof vscode.McpStdioServerDefinition !== 'function') {
        outputChannel.appendLine('MCP server registration skipped: this VS Code version has no mcpServerDefinitionProviders API (1.101+). Run node mcp/server.js for other clients.');
        return null;
    }

    const didChange = new vscode.EventEmitter();
    context.subscriptions.push(
        didChange,
        vscode.workspace.onDidChangeWorkspaceFolders(() => didChange.fire())
    );

    try {
        return vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
            onDidChangeMcpServerDefinitions: didChange.event,
            provideMcpServerDefinitions() {
                const launch = buildMcpLaunch({
                    extensionPath: context.extensionPath,
                    workspacePaths: (vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath),
                    execPath: process.execPath,
                    version: context.extension.packageJSON.version
                });
                const definition = createStdioDefinition(vscode, launch);
                return definition ? [definition] : [];
            },
            resolveMcpServerDefinition(server) {
                return server;
            }
        });
    } catch (error) {
        outputChannel.appendLine(`MCP server registration failed: ${error.message}`);
        return null;
    }
}

function createStdioDefinition(vscode, launch) {
    const cwd = vscode.Uri.file(launch.cwd);
    try {
        const fromOptions = new vscode.McpStdioServerDefinition({
            label: launch.label,
            command: launch.command,
            args: launch.args,
            env: launch.env,
            cwd,
            version: launch.version
        });
        if (fromOptions && typeof fromOptions.command === 'string') {
            return fromOptions;
        }
    } catch {
        // Older builds use the positional constructor.
    }

    const definition = new vscode.McpStdioServerDefinition(
        launch.label,
        launch.command,
        launch.args,
        launch.env,
        launch.version
    );
    definition.cwd = cwd;
    return definition;
}

module.exports = {
    registerMcpServerProvider,
    serverScriptPath(extensionPath) {
        return path.join(extensionPath, 'mcp', 'server.js');
    }
};
