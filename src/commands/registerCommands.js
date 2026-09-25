const { getScriptCommands } = require('./scriptCommands');
const { getFieldCommands } = require('./fieldCommands');
const { getSuiteCloudCommands } = require('./suitecloudCommands');
const { getMigrationCommands } = require('./migrationCommands');
const { getSuiteQLCommands } = require('./suiteqlCommands');
const { getAiCommands } = require('./aiCommands');
const { getIntelligenceCommands } = require('./intelligenceCommands');

const OUTPUT_CHANNEL_NAME = 'NetSuite SuiteScript';

function registerCommands(vscode, context, services) {
    const handlers = {
        ...getScriptCommands(vscode, services),
        ...getFieldCommands(vscode, services),
        ...getSuiteCloudCommands(vscode, services),
        ...getMigrationCommands(vscode, services),
        ...getSuiteQLCommands(vscode, services),
        ...getAiCommands(vscode, services),
        ...getIntelligenceCommands(vscode, services)
    };

    for (const [commandId, handler] of Object.entries(handlers)) {
        context.subscriptions.push(vscode.commands.registerCommand(commandId, async (...args) => {
            try {
                return await handler(...args);
            } catch (error) {
                services.outputChannel.appendLine(`[${commandId}] ${error.stack || error.message}`);
                vscode.window.showErrorMessage(`NetSuite command failed: ${error.message}`);
                return undefined;
            }
        }));
    }

    return Object.keys(handlers);
}

module.exports = {
    registerCommands,
    OUTPUT_CHANNEL_NAME
};
