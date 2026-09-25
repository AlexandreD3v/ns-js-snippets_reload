const path = require('path');
const fs = require('fs');
const { pickFolder } = require('../utils/workspace');
const { getSchemaPath } = require('../suiteql/schema');
const { extractSuiteQLBlocks } = require('../suiteql/suiteqlAnalyzer');
const { importSchemaFile } = require('../suiteql/schemaImport');

function getSuiteQLCommands(vscode, services) {
    return {
        'netsuite.createSuiteQLQuery': () => createSuiteQLQuery(vscode),
        'netsuite.extractSuiteQLToFile': () => extractSuiteQLToFile(vscode),
        'netsuite.insertSuiteQLAsNQuery': () => insertSuiteQLAsNQuery(vscode),
        'netsuite.createSuiteQLSchema': () => createSuiteQLSchema(vscode, services),
        'netsuite.importSuiteQLSchema': () => importSuiteQLSchema(vscode, services)
    };
}

async function createSuiteQLQuery(vscode) {
    const folder = await pickFolder(vscode, 'Select workspace folder for the SuiteQL file');
    const fileName = await vscode.window.showInputBox({
        prompt: 'SuiteQL file name',
        value: 'query.suiteql'
    });
    if (!fileName) {
        return;
    }

    const content = [
        '-- NetSuite SuiteQL query',
        'SELECT',
        '    id,',
        '    entityid',
        'FROM',
        '    customer',
        'WHERE',
        "    isinactive = 'F'",
        ''
    ].join('\n');

    if (!folder) {
        const doc = await vscode.workspace.openTextDocument({ language: 'suiteql', content });
        await vscode.window.showTextDocument(doc);
        return;
    }

    const target = vscode.Uri.file(path.join(folder.uri.fsPath, fileName));
    await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(target));
}

async function extractSuiteQLToFile(vscode) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const blocks = extractSuiteQLBlocks(editor.document.getText());
    if (blocks.length === 0) {
        vscode.window.showWarningMessage('No embedded SuiteQL template literal found.');
        return;
    }

    const folder = await pickFolder(vscode, 'Select folder for extracted SuiteQL file');
    const fileName = await vscode.window.showInputBox({ prompt: 'Extracted file name', value: 'extracted.suiteql' });
    if (!fileName) {
        return;
    }

    const content = blocks[0];
    if (!folder) {
        const doc = await vscode.workspace.openTextDocument({ language: 'suiteql', content });
        await vscode.window.showTextDocument(doc);
        return;
    }

    const target = vscode.Uri.file(path.join(folder.uri.fsPath, fileName));
    await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(target));
}

function insertSuiteQLAsNQuery(vscode) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const queryText = editor.document.languageId === 'suiteql'
        ? editor.document.getText().trim()
        : editor.document.getText(editor.selection);

    editor.insertSnippet(new vscode.SnippetString([
        "const results = query.runSuiteQL({",
        "    query: `",
        queryText.split('\n').map((line) => `        ${line}`).join('\n'),
        "    `,",
        "    params: [$1]",
        "}).asMappedResults();",
        "$0"
    ].join('\n')));
}

async function importSuiteQLSchema(vscode, { outputChannel }) {
    const folder = await pickFolder(vscode, 'Select workspace folder for schema import');
    if (!folder) {
        return;
    }

    const source = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
            'Schema files': ['json', 'csv']
        },
        openLabel: 'Import SuiteQL schema'
    });
    if (!source || source.length === 0) {
        return;
    }

    const targetPath = getSchemaPath(vscode, vscode.Uri.file(folder.uri.fsPath));
    if (!targetPath) {
        vscode.window.showWarningMessage('Could not resolve SuiteQL schema path for this workspace.');
        return;
    }

    try {
        const summary = importSchemaFile(source[0].fsPath, targetPath);
        outputChannel.appendLine(`Imported SuiteQL schema into ${targetPath} (${summary.tableCount} tables, ${summary.columnCount} columns).`);
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(targetPath));
        vscode.window.showInformationMessage(`SuiteQL schema imported (${summary.tableCount} tables).`);
    } catch (error) {
        vscode.window.showErrorMessage(`SuiteQL schema import failed: ${error.message}`);
    }
}

async function createSuiteQLSchema(vscode, { extensionPath }) {
    const folder = await pickFolder(vscode, 'Select workspace folder for SuiteQL schema file');
    if (!folder) {
        return;
    }

    const targetPath = getSchemaPath(vscode, vscode.Uri.file(folder.uri.fsPath));
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(path.join(extensionPath, 'resources', 'netsuite-suiteql-schema.example.json'), targetPath);
    }
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(targetPath));
}

module.exports = {
    getSuiteQLCommands
};
