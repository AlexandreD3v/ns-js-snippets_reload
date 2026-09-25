const { buildContext } = require('./contextBuilder');

function registerLanguageModelTools(vscode, context, services) {
    if (!vscode.lm || typeof vscode.lm.registerTool !== 'function') {
        return [];
    }

    const definitions = [
        {
            name: 'netsuite_get_script_context',
            invoke: async () => toolResult(vscode, services, {})
        },
        {
            name: 'netsuite_analyze_suitescript',
            invoke: async () => {
                const payload = await readActiveContext(vscode, services);
                return JSON.stringify({
                    diagnostics: payload.diagnostics,
                    migration: payload.migration
                }, null, 2);
            }
        },
        {
            name: 'netsuite_get_suiteql_schema',
            invoke: async () => {
                const payload = await readActiveContext(vscode, services);
                return JSON.stringify(payload.suiteqlSchema, null, 2);
            }
        },
        {
            name: 'netsuite_get_sdf_context',
            invoke: async () => {
                const payload = await readActiveContext(vscode, services);
                return JSON.stringify(payload.sdf, null, 2);
            }
        }
    ];

    const subscriptions = [];
    for (const tool of definitions) {
        try {
            subscriptions.push(vscode.lm.registerTool(tool.name, {
                invoke: async () => {
                    const text = await tool.invoke();
                    if (vscode.LanguageModelToolResult && vscode.LanguageModelTextPart) {
                        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
                    }
                    return text;
                }
            }));
        } catch (error) {
            services.outputChannel.appendLine(`LM tool registration skipped for ${tool.name}: ${error.message}`);
        }
    }

    return subscriptions;
}

async function readActiveContext(vscode, services) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return { diagnostics: [], migration: null, suiteqlSchema: null, sdf: null };
    }
    return buildContext(vscode, editor.document, services.data, {
        customFieldStore: services.customFieldStore
    });
}

async function toolResult(vscode, services) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return JSON.stringify({ error: 'No active editor.' });
    }
    return JSON.stringify(buildContext(vscode, editor.document, services.data, {
        customFieldStore: services.customFieldStore
    }), null, 2);
}

module.exports = {
    registerLanguageModelTools
};
