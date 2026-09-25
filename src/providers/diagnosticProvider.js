const { analyzeText } = require('../analysis/suiteScriptAnalyzer');
const { analyzeSuiteQLInJavaScript, analyzeSuiteQLText } = require('../suiteql/suiteqlAnalyzer');
const { analyzeGovernance } = require('../analysis/governanceAnalyzer');

const SUPPORTED_LANGUAGES = new Set(['javascript', 'suiteql']);
const DEBOUNCE_MS = 400;

function createDiagnosticProvider(vscode, data) {
    const collection = vscode.languages.createDiagnosticCollection('netsuite');
    const timers = new Map();

    const validate = (document) => {
        if (!SUPPORTED_LANGUAGES.has(document.languageId)) {
            return;
        }

        const config = vscode.workspace.getConfiguration('netsuite', document.uri);
        if (!config.get('enableDiagnostics', true)) {
            collection.delete(document.uri);
            return;
        }

        collection.set(document.uri, analyzeDocument(vscode, document, data));
    };

    const scheduleValidate = (document) => {
        const key = document.uri.toString();
        clearTimeout(timers.get(key));
        timers.set(key, setTimeout(() => {
            timers.delete(key);
            validate(document);
        }, DEBOUNCE_MS));
    };

    const clear = (document) => {
        const key = document.uri.toString();
        clearTimeout(timers.get(key));
        timers.delete(key);
        collection.delete(document.uri);
    };

    const subscriptions = [
        collection,
        vscode.workspace.onDidOpenTextDocument(validate),
        vscode.workspace.onDidSaveTextDocument(validate),
        vscode.workspace.onDidChangeTextDocument((event) => scheduleValidate(event.document)),
        vscode.workspace.onDidCloseTextDocument(clear),
        { dispose: () => timers.forEach((timer) => clearTimeout(timer)) }
    ];

    vscode.workspace.textDocuments.forEach(validate);
    return subscriptions;
}

function collectFindings(vscode, document, data) {
    const text = document.getText();

    if (document.languageId === 'suiteql') {
        return analyzeSuiteQLText(text);
    }

    const config = vscode.workspace.getConfiguration('netsuite', document.uri);
    const findings = [...analyzeText(text, data), ...analyzeSuiteQLInJavaScript(text)];

    if (config.get('enableGovernanceDiagnostics', true)) {
        findings.push(...analyzeGovernance(text, data.governance).findings);
    }

    return findings;
}

function analyzeDocument(vscode, document, data) {
    return collectFindings(vscode, document, data).map((item) => toDiagnostic(vscode, document, item));
}

function toDiagnostic(vscode, document, item) {
    const line = Math.min(Math.max(item.line, 0), Math.max(document.lineCount - 1, 0));
    const lineLength = document.lineAt(line).text.length;
    const startColumn = Math.min(item.column || 0, lineLength);
    const endColumn = item.endColumn && item.endColumn > startColumn ? Math.min(item.endColumn, lineLength) : lineLength;
    const diagnostic = new vscode.Diagnostic(
        new vscode.Range(line, startColumn, line, endColumn),
        item.message,
        toSeverity(vscode, item.severity)
    );
    diagnostic.source = 'netsuite';
    if (item.code) {
        diagnostic.code = item.code;
    }
    return diagnostic;
}

function toSeverity(vscode, severity) {
    if (severity === 'error') {
        return vscode.DiagnosticSeverity.Error;
    }
    if (severity === 'warning') {
        return vscode.DiagnosticSeverity.Warning;
    }
    if (severity === 'hint') {
        return vscode.DiagnosticSeverity.Hint;
    }
    return vscode.DiagnosticSeverity.Information;
}

module.exports = {
    createDiagnosticProvider,
    analyzeDocument,
    collectFindings,
    toDiagnostic
};
