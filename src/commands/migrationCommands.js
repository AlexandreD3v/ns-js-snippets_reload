const path = require('path');
const fs = require('fs');
const { auditWorkspace, toMarkdownReport } = require('../migration/audit');
const { convertTo21 } = require('../migration/convert');
const { listFiles, getWorkspaceFolders } = require('../utils/workspace');

function getMigrationCommands(vscode, services) {
    return {
        'netsuite.auditWorkspace21': () => auditWorkspaceCommand(vscode, services),
        'netsuite.convertCurrentScript21': () => convertCurrentScript(vscode, services),
        'netsuite.convertWorkspace21': () => convertWorkspace(vscode, services)
    };
}

function collectJavaScriptFiles(folders) {
    const files = [];
    for (const folder of folders) {
        for (const filePath of listFiles(folder.uri.fsPath, (p) => p.endsWith('.js'))) {
            files.push({
                path: filePath,
                content: fs.readFileSync(filePath, 'utf8')
            });
        }
    }
    return files;
}

async function auditWorkspaceCommand(vscode, { outputChannel }) {
    const folders = getWorkspaceFolders(vscode);
    if (folders.length === 0) {
        vscode.window.showWarningMessage('Open a workspace folder to audit SuiteScript files.');
        return;
    }

    const report = auditWorkspace(collectJavaScriptFiles(folders));
    const markdown = toMarkdownReport(report);
    const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: markdown });
    await vscode.window.showTextDocument(doc, { preview: false });

    outputChannel.clear();
    outputChannel.appendLine(markdown);
    outputChannel.show(true);

    vscode.window.showInformationMessage(
        `Audit complete: ${report.summary.needsUpgrade} file(s) need upgrade, ${report.summary.withManualReview} with manual-review notes.`
    );
}

async function convertCurrentScript(vscode, services) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'javascript') {
        vscode.window.showWarningMessage('Open a JavaScript SuiteScript file to convert.');
        return;
    }

    const original = editor.document.getText();
    const result = convertTo21(original);
    if (!result.changed && result.audit.manualReview.length === 0) {
        vscode.window.showInformationMessage('File is already aligned with SuiteScript 2.1.');
        return;
    }

    const preview = await vscode.window.showInformationMessage(
        'Apply SuiteScript 2.1 conversion to the current file?',
        'Preview diff',
        'Apply',
        'Cancel'
    );
    if (preview === 'Cancel' || !preview) {
        return;
    }

    if (preview === 'Preview diff') {
        const left = vscode.Uri.parse(`netsuite-original:${editor.document.fileName}`);
        const right = editor.document.uri;
        services.context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('netsuite-original', {
            provideTextDocumentContent: () => original
        }));
        await vscode.commands.executeCommand('vscode.diff', left, right, 'SuiteScript 2.1 conversion preview');
        return;
    }

    await applyConversion(vscode, editor.document.uri, original, result.output, services);
}

async function convertWorkspace(vscode, services) {
    const folders = getWorkspaceFolders(vscode);
    const candidates = collectJavaScriptFiles(folders)
        .map((file) => ({ ...file, result: convertTo21(file.content) }))
        .filter((file) => file.result.changed);

    if (candidates.length === 0) {
        vscode.window.showInformationMessage('No convertible SuiteScript files found.');
        return;
    }

    const choice = await vscode.window.showWarningMessage(
        `Convert ${candidates.length} file(s) to SuiteScript 2.1?`,
        'Convert',
        'Cancel'
    );
    if (choice !== 'Convert') {
        return;
    }

    for (const file of candidates) {
        await applyConversion(vscode, vscode.Uri.file(file.path), file.content, file.result.output, services);
    }
}

async function applyConversion(vscode, uri, original, converted, services) {
    const document = await vscode.workspace.openTextDocument(uri);
    const lastLine = Math.max(document.lineCount - 1, 0);
    const endCharacter = document.lineAt(lastLine).text.length;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, lastLine, endCharacter), converted);
    await vscode.workspace.applyEdit(edit);
    services.outputChannel.appendLine(`Converted ${uri.fsPath || uri.path}`);
}

module.exports = {
    getMigrationCommands
};
