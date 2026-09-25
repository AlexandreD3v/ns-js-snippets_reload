const path = require('path');
const { buildScriptContent, getScriptTypeOptions, findScriptTypeByLabel } = require('../utils/scriptTemplates');
const { analyzeDocument } = require('../providers/diagnosticProvider');
const { pickFolder } = require('../utils/workspace');

function getScriptCommands(vscode, services) {
    return {
        'netsuite.newScript': () => newScriptFromTemplate(vscode, services),
        'netsuite.insertScriptParameters': () => insertScriptParameters(vscode),
        'netsuite.wrapSelectionInDefine': () => wrapSelectionInDefine(vscode),
        'netsuite.validateFile': () => validateCurrentFile(vscode, services)
    };
}

function getActiveJavaScriptEditor(vscode, message) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'javascript') {
        vscode.window.showWarningMessage(message);
        return null;
    }
    return editor;
}

async function newScriptFromTemplate(vscode, { data }) {
    const scriptTypePick = await vscode.window.showQuickPick(
        getScriptTypeOptions().map((item) => item.label),
        { placeHolder: 'Select a SuiteScript type' }
    );
    if (!scriptTypePick) {
        return;
    }

    const scriptType = findScriptTypeByLabel(scriptTypePick);
    const folder = await pickFolder(vscode, 'Select the workspace folder for the new script');
    const config = vscode.workspace.getConfiguration('netsuite', folder?.uri);
    const content = buildScriptContent(scriptType.key, data.entryPoints, {
        apiVersion: config.get('defaultApiVersion', '2.1'),
        moduleScope: config.get('defaultModuleScope', 'SameAccount')
    });

    const fileName = await vscode.window.showInputBox({
        prompt: 'Script file path relative to the workspace folder',
        value: `${toFileName(scriptType.annotation)}.js`,
        validateInput: (value) => {
            if (!value.endsWith('.js')) {
                return 'File name should end with .js';
            }
            if (path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
                return 'Use a path inside the workspace folder';
            }
            return null;
        }
    });
    if (!fileName) {
        return;
    }

    if (!folder) {
        const document = await vscode.workspace.openTextDocument({ language: 'javascript', content });
        await vscode.window.showTextDocument(document);
        return;
    }

    const targetUri = vscode.Uri.file(path.join(folder.uri.fsPath, fileName));
    if (!(await confirmOverwrite(vscode, targetUri))) {
        return;
    }

    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(targetUri.fsPath)));
    await vscode.workspace.fs.writeFile(targetUri, Buffer.from(content, 'utf8'));
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(targetUri));
}

async function confirmOverwrite(vscode, targetUri) {
    try {
        await vscode.workspace.fs.stat(targetUri);
    } catch {
        return true;
    }

    const answer = await vscode.window.showWarningMessage(
        `${path.basename(targetUri.fsPath)} already exists. Overwrite it?`,
        { modal: true },
        'Overwrite'
    );
    return answer === 'Overwrite';
}

function insertScriptParameters(vscode) {
    const editor = getActiveJavaScriptEditor(vscode, 'Open a JavaScript file to insert script parameters.');
    if (!editor) {
        return;
    }

    editor.insertSnippet(new vscode.SnippetString([
        '// Script Parameter: ${1:custscript_my_param}',
        '// Type: ${2|Text,Integer,Checkbox,Select,Date|}',
        '// Description: ${3:Parameter description}',
        '$0'
    ].join('\n')));
}

function wrapSelectionInDefine(vscode) {
    const editor = getActiveJavaScriptEditor(vscode, 'Open a JavaScript file to wrap code in define().');
    if (!editor) {
        return;
    }

    const selectionText = editor.document.getText(editor.selection);
    if (!selectionText.trim()) {
        vscode.window.showWarningMessage('Select the code you want to wrap in define().');
        return;
    }

    const config = vscode.workspace.getConfiguration('netsuite', editor.document.uri);
    const body = selectionText.split(/\r?\n/).map((line) => (line ? `    ${line}` : line)).join('\n');
    const wrapped = [
        '/**',
        ` * @NApiVersion ${config.get('defaultApiVersion', '2.1')}`,
        ` * @NModuleScope ${config.get('defaultModuleScope', 'SameAccount')}`,
        ' */',
        'define([], () => {',
        body,
        '',
        '    return {',
        '    };',
        '});',
        ''
    ].join('\n');

    editor.edit((editBuilder) => editBuilder.replace(editor.selection, wrapped));
}

function validateCurrentFile(vscode, { data, outputChannel }) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !['javascript', 'suiteql'].includes(editor.document.languageId)) {
        vscode.window.showWarningMessage('Open a SuiteScript or SuiteQL file to validate.');
        return;
    }

    const diagnostics = analyzeDocument(vscode, editor.document, data);
    outputChannel.clear();
    outputChannel.appendLine(`Validation results for ${editor.document.fileName}`);
    outputChannel.appendLine('');

    if (diagnostics.length === 0) {
        outputChannel.appendLine('No SuiteScript issues found.');
    }
    for (const diagnostic of diagnostics) {
        outputChannel.appendLine(
            `Line ${diagnostic.range.start.line + 1} [${severityLabel(vscode, diagnostic.severity)}]: ${diagnostic.message}`
        );
    }
    outputChannel.show(true);
}

function severityLabel(vscode, severity) {
    const labels = {
        [vscode.DiagnosticSeverity.Error]: 'Error',
        [vscode.DiagnosticSeverity.Warning]: 'Warning',
        [vscode.DiagnosticSeverity.Hint]: 'Hint'
    };
    return labels[severity] || 'Info';
}

function toFileName(annotation) {
    return annotation.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

module.exports = {
    getScriptCommands
};
