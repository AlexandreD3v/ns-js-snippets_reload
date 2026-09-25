function activate(context) {
    const vscode = require('vscode');

    const provider = vscode.languages.registerCompletionItemProvider(
        { language: 'javascript' },
        {
            provideCompletionItems(document, position) {
                const suggestions = [];
                const linePrefix = document.lineAt(position).text.slice(0, position.character);
                const documentText = document.getText();
                const detectedScriptType = detectScriptType(documentText);

                if (shouldSuggestModules(linePrefix)) {
                    suggestions.push(...createModuleItems(vscode));
                }

                if (shouldSuggestAnnotations(linePrefix)) {
                    suggestions.push(...createAnnotationItems(vscode));
                }

                if (detectedScriptType && shouldSuggestEntryPoints(linePrefix)) {
                    suggestions.push(...createEntryPointItems(vscode, detectedScriptType, documentText));
                }

                return suggestions;
            }
        },
        '/',
        '@',
        "'",
        '"'
    );

    context.subscriptions.push(provider);
}

function deactivate() {}

function shouldSuggestModules(linePrefix) {
    return /define\s*\(\s*\[[^\]]*$/.test(linePrefix) ||
        /['"]N\/[\w/]*$/.test(linePrefix) ||
        /\bN\/[\w/]*$/.test(linePrefix);
}

function shouldSuggestAnnotations(linePrefix) {
    return /\/\*\*?$/.test(linePrefix) ||
        /^\s*\*\s*@?[A-Za-z]*$/.test(linePrefix) ||
        /^\s*@[A-Za-z]*$/.test(linePrefix);
}

function shouldSuggestEntryPoints(linePrefix) {
    return /^\s*$/.test(linePrefix) ||
        /^\s*(function\s+)?[A-Za-z_]*$/.test(linePrefix);
}

function detectScriptType(documentText) {
    const match = documentText.match(/@NScriptType\s+([A-Za-z]+)/i);
    return match ? match[1].toLowerCase() : null;
}

function createModuleItems(vscode) {
    return MODULE_SUGGESTIONS.map((moduleSuggestion) => {
        const item = new vscode.CompletionItem(moduleSuggestion.label, vscode.CompletionItemKind.Module);
        item.insertText = new vscode.SnippetString("'" + moduleSuggestion.label + "'");
        item.detail = moduleSuggestion.detail;
        item.documentation = new vscode.MarkdownString(moduleSuggestion.documentation);
        item.sortText = "0_" + moduleSuggestion.label;
        return item;
    });
}

function createAnnotationItems(vscode) {
    return ANNOTATION_SUGGESTIONS.map((annotationSuggestion) => {
        const item = new vscode.CompletionItem(annotationSuggestion.label, vscode.CompletionItemKind.Snippet);
        item.insertText = new vscode.SnippetString(annotationSuggestion.insertText);
        item.detail = annotationSuggestion.detail;
        item.documentation = new vscode.MarkdownString(annotationSuggestion.documentation);
        item.sortText = "1_" + annotationSuggestion.label;
        return item;
    });
}

function createEntryPointItems(vscode, scriptType, documentText) {
    const entryPoints = ENTRY_POINT_SUGGESTIONS[scriptType] || [];

    return entryPoints
        .filter((entryPoint) => !new RegExp("\\bfunction\\s+" + entryPoint.label + "\\s*\\(").test(documentText))
        .map((entryPoint) => {
            const item = new vscode.CompletionItem(entryPoint.label, vscode.CompletionItemKind.Function);
            item.insertText = new vscode.SnippetString(entryPoint.snippet);
            item.detail = entryPoint.detail;
            item.documentation = new vscode.MarkdownString(entryPoint.documentation);
            item.sortText = "2_" + entryPoint.label;
            return item;
        });
}

const MODULE_SUGGESTIONS = [
    {
        label: 'N/currentRecord',
        detail: 'SuiteScript module',
        documentation: 'Access the current record in client scripts.'
    },
    {
        label: 'N/error',
        detail: 'SuiteScript module',
        documentation: 'Create and throw SuiteScript errors.'
    },
    {
        label: 'N/https',
        detail: 'SuiteScript module',
        documentation: 'Send outbound HTTPS requests.'
    },
    {
        label: 'N/log',
        detail: 'SuiteScript module',
        documentation: 'Write script execution logs.'
    },
    {
        label: 'N/record',
        detail: 'SuiteScript module',
        documentation: 'Create, load, update and delete NetSuite records.'
    },
    {
        label: 'N/redirect',
        detail: 'SuiteScript module',
        documentation: 'Redirect users to records, tasks or Suitelets.'
    },
    {
        label: 'N/runtime',
        detail: 'SuiteScript module',
        documentation: 'Read runtime context, script parameters and enabled features.'
    },
    {
        label: 'N/search',
        detail: 'SuiteScript module',
        documentation: 'Build and run saved searches.'
    },
    {
        label: 'N/task',
        detail: 'SuiteScript module',
        documentation: 'Create and submit background tasks.'
    },
    {
        label: 'N/ui/message',
        detail: 'SuiteScript module',
        documentation: 'Show UI messages in supported contexts.'
    },
    {
        label: 'N/ui/serverWidget',
        detail: 'SuiteScript module',
        documentation: 'Build Suitelet forms, fields, tabs and sublists.'
    },
    {
        label: 'N/url',
        detail: 'SuiteScript module',
        documentation: 'Resolve internal and external NetSuite URLs.'
    }
];

const ANNOTATION_SUGGESTIONS = [
    {
        label: '@NApiVersion 2.x',
        insertText: '@NApiVersion 2.x',
        detail: 'SuiteScript annotation',
        documentation: 'Defines the SuiteScript API version for the file.'
    },
    {
        label: '@NApiVersion 2.1',
        insertText: '@NApiVersion 2.1',
        detail: 'SuiteScript annotation',
        documentation: 'Defines the SuiteScript API version when using SuiteScript 2.1.'
    },
    {
        label: '@NModuleScope SameAccount',
        insertText: '@NModuleScope SameAccount',
        detail: 'SuiteScript annotation',
        documentation: 'Restricts module execution to the same NetSuite account.'
    },
    {
        label: '@NScriptType ClientScript',
        insertText: '@NScriptType ClientScript',
        detail: 'SuiteScript annotation',
        documentation: 'Marks the file as a Client Script.'
    },
    {
        label: '@NScriptType UserEventScript',
        insertText: '@NScriptType UserEventScript',
        detail: 'SuiteScript annotation',
        documentation: 'Marks the file as a User Event Script.'
    },
    {
        label: '@NScriptType Suitelet',
        insertText: '@NScriptType Suitelet',
        detail: 'SuiteScript annotation',
        documentation: 'Marks the file as a Suitelet.'
    },
    {
        label: '@NScriptType Restlet',
        insertText: '@NScriptType Restlet',
        detail: 'SuiteScript annotation',
        documentation: 'Marks the file as a RESTlet.'
    },
    {
        label: '@NScriptType MapReduceScript',
        insertText: '@NScriptType MapReduceScript',
        detail: 'SuiteScript annotation',
        documentation: 'Marks the file as a Map/Reduce script.'
    },
    {
        label: '@NScriptType ScheduledScript',
        insertText: '@NScriptType ScheduledScript',
        detail: 'SuiteScript annotation',
        documentation: 'Marks the file as a Scheduled Script.'
    },
    {
        label: '@NScriptType WorkflowActionScript',
        insertText: '@NScriptType WorkflowActionScript',
        detail: 'SuiteScript annotation',
        documentation: 'Marks the file as a Workflow Action Script.'
    }
];

const ENTRY_POINT_SUGGESTIONS = {
    clientscript: [
        entryPoint('pageInit', 'context', 'ClientScript entry point', 'Runs when the page is initialized.'),
        entryPoint('fieldChanged', 'context', 'ClientScript entry point', 'Runs after a field value changes.'),
        entryPoint('postSourcing', 'context', 'ClientScript entry point', 'Runs after a field is sourced.'),
        entryPoint('lineInit', 'context', 'ClientScript entry point', 'Runs when a sublist line is initialized.'),
        validatorEntryPoint('validateField', 'context', 'ClientScript entry point', 'Runs before a field value is accepted.'),
        validatorEntryPoint('validateInsert', 'context', 'ClientScript entry point', 'Runs before a line is inserted into a sublist.'),
        validatorEntryPoint('validateLine', 'context', 'ClientScript entry point', 'Runs before a sublist line is committed.'),
        validatorEntryPoint('validateDelete', 'context', 'ClientScript entry point', 'Runs before a sublist line is removed.'),
        validatorEntryPoint('saveRecord', 'context', 'ClientScript entry point', 'Runs before the record is saved.'),
        entryPoint('sublistChanged', 'context', 'ClientScript entry point', 'Runs after a sublist changes.')
    ],
    usereventscript: [
        entryPoint('beforeLoad', 'context', 'UserEvent entry point', 'Runs before a record is loaded.'),
        entryPoint('beforeSubmit', 'context', 'UserEvent entry point', 'Runs before a record is submitted.'),
        entryPoint('afterSubmit', 'context', 'UserEvent entry point', 'Runs after a record is submitted.')
    ],
    suitelet: [
        {
            label: 'onRequest',
            snippet: "function onRequest(context) {\n\tif (context.request.method === 'GET') {\n\t\t$0\n\t\treturn;\n\t}\n\n\tif (context.request.method === 'POST') {\n\t\t\n\t}\n}",
            detail: 'Suitelet entry point',
            documentation: 'Handles Suitelet GET and POST requests.'
        }
    ],
    restlet: [
        restletEntryPoint('get', 'Handles RESTlet GET requests.'),
        restletEntryPoint('post', 'Handles RESTlet POST requests.'),
        restletEntryPoint('put', 'Handles RESTlet PUT requests.'),
        restletEntryPoint('_delete', 'Handles RESTlet DELETE requests.')
    ],
    mapreducescript: [
        entryPoint('getInputData', '', 'Map/Reduce entry point', 'Provides the input data set for the script.'),
        entryPoint('map', 'context', 'Map/Reduce entry point', 'Processes each input key/value pair.'),
        entryPoint('reduce', 'context', 'Map/Reduce entry point', 'Aggregates values by key.'),
        entryPoint('summarize', 'summary', 'Map/Reduce entry point', 'Handles post-processing and execution summary.')
    ],
    scheduledscript: [
        entryPoint('execute', 'context', 'Scheduled Script entry point', 'Runs the scheduled execution.'),
    ],
    workflowactionscript: [
        entryPoint('onAction', 'scriptContext', 'Workflow Action entry point', 'Runs when the workflow action executes.'),
    ]
};

function entryPoint(label, parameterName, detail, documentation) {
    const parameterSection = parameterName ? parameterName : '';
    return {
        label,
        snippet: "function " + label + "(" + parameterSection + ") {\n\t$0\n}",
        detail,
        documentation
    };
}

function validatorEntryPoint(label, parameterName, detail, documentation) {
    return {
        label,
        snippet: "function " + label + "(" + parameterName + ") {\n\t$0\n\treturn true;\n}",
        detail,
        documentation
    };
}

function restletEntryPoint(label, documentation) {
    return {
        label,
        snippet: "function " + label + "(request) {\n\t$0\n}",
        detail: 'RESTlet entry point',
        documentation
    };
}

module.exports = {
    activate,
    deactivate
};
