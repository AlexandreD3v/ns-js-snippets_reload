const { buildContext } = require('./contextBuilder');

const LM_TOOL_NAMES = [
    'netsuite_get_script_context',
    'netsuite_analyze_suitescript',
    'netsuite_get_suiteql_schema',
    'netsuite_get_sdf_context'
];

function registerLanguageModelTools(vscode, context, services) {
    if (!vscode.lm || typeof vscode.lm.registerTool !== 'function') {
        return [];
    }

    const definitions = [
        {
            name: LM_TOOL_NAMES[0],
            invoke: async () => toolResult(vscode, services)
        },
        {
            name: LM_TOOL_NAMES[1],
            invoke: async () => {
                const payload = await readActiveContext(vscode, services);
                return JSON.stringify({
                    diagnostics: payload.diagnostics,
                    migration: payload.migration
                }, null, 2);
            }
        },
        {
            name: LM_TOOL_NAMES[2],
            invoke: async () => {
                const payload = await readActiveContext(vscode, services);
                return JSON.stringify(payload.suiteqlSchema, null, 2);
            }
        },
        {
            name: LM_TOOL_NAMES[3],
            invoke: async () => {
                const payload = await readActiveContext(vscode, services);
                return JSON.stringify(payload.sdf, null, 2);
            }
        }
    ];

    const subscriptions = [];
    const failures = [];
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
            failures.push(`${tool.name}: ${error.message}`);
        }
    }

    if (failures.length > 0) {
        services.outputChannel.appendLine('Language model tools were not registered.');
        for (const failure of failures) {
            services.outputChannel.appendLine(`- ${failure}`);
        }
        services.outputChannel.appendLine('Confirm that package.json contributes.languageModelTools matches these names and that VS Code is 1.95 or newer.');
        services.outputChannel.show(true);
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
    registerLanguageModelTools,
    LM_TOOL_NAMES
};
