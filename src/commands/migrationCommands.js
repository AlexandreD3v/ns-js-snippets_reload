const path = require('path');
const fs = require('fs');
const { auditWorkspace, toMarkdownReport } = require('../migration/audit');
const { convertTo21, isSuiteScriptFile, looksLikeSuiteScript } = require('../migration/convert');
const { listFiles, getWorkspaceFolders } = require('../utils/workspace');

const previewContents = new Map();
let previewProviderRegistered = false;

function getMigrationCommands(vscode, services) {
    return {
        'netsuite.auditWorkspace21': () => auditWorkspaceCommand(vscode, services),
        'netsuite.convertCurrentScript21': () => convertCurrentScript(vscode, services),
        'netsuite.convertWorkspace21': () => convertWorkspace(vscode, services)
    };
}

function collectSuiteScriptFiles(vscode, folders) {
    const openDocuments = vscode.workspace.textDocuments || [];
    const files = [];
    for (const folder of folders) {
        for (const filePath of listFiles(folder.uri.fsPath, (candidate) => candidate.endsWith('.js'))) {
            const open = openDocuments.find((document) => document.uri?.fsPath === filePath);
            const content = open ? open.getText() : fs.readFileSync(filePath, 'utf8');
            if (!isSuiteScriptFile(filePath, content)) {
                continue;
            }
            files.push({ path: filePath, content });
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

    const report = auditWorkspace(collectSuiteScriptFiles(vscode, folders));
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
    if (!looksLikeSuiteScript(original)) {
        vscode.window.showWarningMessage('This file does not look like SuiteScript (no define() or @NApiVersion). Nothing was changed.');
        return;
    }

    const result = convertTo21(original);
    if (!result.changed) {
        if (result.audit.manualReview.length > 0) {
            reportNotes(services, `Manual review for ${editor.document.fileName}`, result.audit.manualReview);
            services.outputChannel.show(true);
            vscode.window.showInformationMessage('File is already aligned with SuiteScript 2.1. Manual review notes are in the NetSuite SuiteScript output.');
        } else {
            vscode.window.showInformationMessage('File is already aligned with SuiteScript 2.1.');
        }
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
        await showConversionDiff(vscode, services, editor.document.fileName, original, result.output);
        const apply = await vscode.window.showInformationMessage(
            'Apply the SuiteScript 2.1 conversion shown in the diff?',
            'Apply',
            'Cancel'
        );
        if (apply !== 'Apply') {
            vscode.window.showInformationMessage('SuiteScript 2.1 conversion was not applied.');
            return;
        }
    }

    reportNotes(services, `Manual review for ${editor.document.fileName}`, result.audit.manualReview);
    await applyConversion(vscode, editor.document.uri, result.output, services);
}

async function convertWorkspace(vscode, services) {
    const folders = getWorkspaceFolders(vscode);
    if (folders.length === 0) {
        vscode.window.showWarningMessage('Open a workspace folder to convert SuiteScript files.');
        return;
    }

    const analyzed = collectSuiteScriptFiles(vscode, folders)
        .map((file) => ({ ...file, result: convertTo21(file.content) }));
    const candidates = analyzed.filter((file) => file.result.changed);

    if (candidates.length === 0) {
        vscode.window.showInformationMessage('No convertible SuiteScript files found. Config files such as suitecloud.config.js are left untouched.');
        return;
    }

    const choice = await vscode.window.showWarningMessage(
        `Convert ${candidates.length} SuiteScript file(s) to 2.1? Non-SuiteScript files are skipped.`,
        { modal: true },
        'Convert',
        'Cancel'
    );
    if (choice !== 'Convert') {
        return;
    }

    let saved = 0;
    let failed = 0;
    services.outputChannel.appendLine('');
    services.outputChannel.appendLine(`Converting ${candidates.length} SuiteScript file(s) to 2.1.`);
    for (const file of candidates) {
        reportNotes(services, file.path, file.result.audit.manualReview);
        const ok = await applyConversion(vscode, vscode.Uri.file(file.path), file.result.output, services, { announce: false });
        if (ok) {
            saved += 1;
        } else {
            failed += 1;
        }
    }

    const summary = failed === 0
        ? `Converted ${saved} SuiteScript file(s) to 2.1 and saved them.`
        : `Converted ${saved} SuiteScript file(s) to 2.1. ${failed} file(s) could not be saved.`;
    services.outputChannel.appendLine(summary);
    services.outputChannel.show(true);
    if (failed === 0) {
        vscode.window.showInformationMessage(summary);
    } else {
        vscode.window.showWarningMessage(summary);
    }
}

async function showConversionDiff(vscode, services, fileName, original, converted) {
    ensurePreviewProvider(vscode, services.context);
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const baseName = path.basename(fileName || 'script.js');
    const originalUri = vscode.Uri.from({
        scheme: 'netsuite-convert',
        path: `/original/${baseName}`,
        query: stamp
    });
    const convertedUri = vscode.Uri.from({
        scheme: 'netsuite-convert',
        path: `/converted/${baseName}`,
        query: stamp
    });
    previewContents.set(originalUri.toString(), original);
    previewContents.set(convertedUri.toString(), converted);
    await vscode.commands.executeCommand(
        'vscode.diff',
        originalUri,
        convertedUri,
        `SuiteScript 2.1 preview: ${baseName}`
    );
}

function ensurePreviewProvider(vscode, context) {
    if (previewProviderRegistered) {
        return;
    }
    previewProviderRegistered = true;
    const provider = vscode.workspace.registerTextDocumentContentProvider('netsuite-convert', {
        provideTextDocumentContent(uri) {
            return previewContents.get(uri.toString()) || '';
        }
    });
    context.subscriptions.push(provider);
}

function reportNotes(services, title, notes) {
    if (!notes || notes.length === 0) {
        return;
    }
    services.outputChannel.appendLine(title);
    for (const note of notes) {
        services.outputChannel.appendLine(`- ${note}`);
    }
}

async function applyConversion(vscode, uri, converted, services, options = {}) {
    const document = await vscode.workspace.openTextDocument(uri);
    const lastLine = Math.max(document.lineCount - 1, 0);
    const endCharacter = document.lineAt(lastLine).text.length;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, lastLine, endCharacter), converted);
    const applied = await vscode.workspace.applyEdit(edit);
    const label = path.basename(document.fileName);
    if (!applied) {
        const message = `Could not apply SuiteScript 2.1 conversion to ${label}.`;
        services.outputChannel.appendLine(message);
        if (options.announce !== false) {
            vscode.window.showErrorMessage(message);
        }
        return false;
    }

    if (document.uri.scheme === 'file' && document.isDirty) {
        const saved = await document.save();
        if (!saved) {
            const message = `Converted ${label}, but the file could not be saved.`;
            services.outputChannel.appendLine(message);
            if (options.announce !== false) {
                vscode.window.showErrorMessage(message);
            }
            return false;
        }
    }

    services.outputChannel.appendLine(`Converted ${document.uri.fsPath || document.fileName}`);
    if (options.announce !== false) {
        vscode.window.showInformationMessage(`Converted ${label} to SuiteScript 2.1.`);
    }
    return true;
}

module.exports = {
    getMigrationCommands
};
