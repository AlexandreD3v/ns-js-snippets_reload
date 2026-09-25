const {
    detectScriptType,
    hasDefine,
    hasNApiVersion,
    getApiVersion,
    getWrongEntryPointsForScriptType,
    getUnexportedEntryPoints,
    getDefinedFunctions,
    getExportedEntryPoints
} = require('../utils/parseSuiteScript');

function createDiagnosticProvider(vscode, data) {
    const collection = vscode.languages.createDiagnosticCollection('netsuite');
    let debounceTimer = null;

    const validate = (document) => {
        if (document.languageId !== 'javascript') {
            return;
        }

        const config = vscode.workspace.getConfiguration('netsuite');
        if (!config.get('enableDiagnostics', true)) {
            collection.delete(document.uri);
            return;
        }

        const diagnostics = analyzeDocument(vscode, document, data);
        collection.set(document.uri, diagnostics);
    };

    const scheduleValidate = (document) => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => validate(document), 400);
    };

    const subscriptions = [
        collection,
        vscode.workspace.onDidOpenTextDocument(validate),
        vscode.workspace.onDidSaveTextDocument(validate),
        vscode.workspace.onDidChangeTextDocument((event) => scheduleValidate(event.document))
    ];

    for (const document of vscode.workspace.textDocuments) {
        validate(document);
    }

    return subscriptions;
}

function analyzeDocument(vscode, document, data) {
    const text = document.getText();
    const diagnostics = [];

    if (!hasDefine(text) && !/@NScriptType/i.test(text)) {
        return diagnostics;
    }

    if (hasDefine(text) && !hasNApiVersion(text)) {
        diagnostics.push(createDiagnostic(
            vscode,
            document,
            0,
            0,
            document.lineAt(0).text.length,
            'Missing @NApiVersion annotation.',
            vscode.DiagnosticSeverity.Warning
        ));
    }

    const scriptType = detectScriptType(text);

    if (hasDefine(text) && !scriptType && /@NScriptType/i.test(text) === false) {
        diagnostics.push(createDiagnostic(
            vscode,
            document,
            0,
            0,
            document.lineAt(0).text.length,
            'SuiteScript file should include an @NScriptType annotation.',
            vscode.DiagnosticSeverity.Warning
        ));
    }

    if (hasDefine(text) && !/return\s*\{/.test(text)) {
        const defineLine = findLineIndex(document, /\bdefine\s*\(/);
        diagnostics.push(createDiagnostic(
            vscode,
            document,
            defineLine,
            0,
            document.lineAt(defineLine).text.length,
            'AMD module should return an object with entry points: return { ... }.',
            vscode.DiagnosticSeverity.Warning
        ));
    }

    const apiVersion = getApiVersion(text);
    if (apiVersion && apiVersion.startsWith('2.0') && /=>\s*\{/.test(text)) {
        const arrowLine = findLineIndex(document, /=>\s*\{/);
        diagnostics.push(createDiagnostic(
            vscode,
            document,
            arrowLine,
            0,
            document.lineAt(arrowLine).text.length,
            'Arrow functions in return objects require @NApiVersion 2.1 or later.',
            vscode.DiagnosticSeverity.Information
        ));
    }

    if (scriptType) {
        for (const wrongEntryPoint of getWrongEntryPointsForScriptType(text, scriptType, data.entryPoints)) {
            const line = findLineIndex(document, new RegExp(`\\b${wrongEntryPoint}\\b`));
            diagnostics.push(createDiagnostic(
                vscode,
                document,
                line,
                0,
                document.lineAt(line).text.length,
                `'${wrongEntryPoint}' is not a valid entry point for @NScriptType ${scriptType}.`,
                vscode.DiagnosticSeverity.Warning
            ));
        }

        for (const unexportedEntryPoint of getUnexportedEntryPoints(text, scriptType, data.entryPoints)) {
            const line = findLineIndex(document, new RegExp(`\\bfunction\\s+${unexportedEntryPoint}\\s*\\(`));
            diagnostics.push(createDiagnostic(
                vscode,
                document,
                line,
                0,
                document.lineAt(line).text.length,
                `'${unexportedEntryPoint}' is defined but not exported in the return object.`,
                vscode.DiagnosticSeverity.Warning
            ));
        }

        const expectedEntryPoints = new Set((data.entryPoints[scriptType] || []).map((entryPoint) => entryPoint.label));
        const allKnownEntryPoints = new Set(Object.values(data.entryPoints).flat().map((entryPoint) => entryPoint.label));
        const exported = getExportedEntryPoints(text);

        for (const exportedName of exported) {
            if (allKnownEntryPoints.has(exportedName) && !expectedEntryPoints.has(exportedName)) {
                const line = findLineIndex(document, new RegExp(`${exportedName}\\s*:`));
                diagnostics.push(createDiagnostic(
                    vscode,
                    document,
                    line,
                    0,
                    document.lineAt(line).text.length,
                    `'${exportedName}' is exported but is not valid for @NScriptType ${scriptType}.`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }

    }

    return diagnostics;
}

function findLineIndex(document, pattern) {
    for (let line = 0; line < document.lineCount; line++) {
        if (pattern.test(document.lineAt(line).text)) {
            return line;
        }
    }

    return 0;
}

function createDiagnostic(vscode, document, line, startChar, endChar, message, severity) {
    const range = new vscode.Range(line, startChar, line, endChar);
    const diagnostic = new vscode.Diagnostic(range, message, severity);
    diagnostic.source = 'netsuite';
    return diagnostic;
}

module.exports = {
    createDiagnosticProvider
};
