const path = require('path');
const fs = require('fs');
const { pickFolder } = require('../utils/workspace');
const { getSchemaPath } = require('../suiteql/schema');
const { extractSuiteQLBlocks } = require('../suiteql/suiteqlAnalyzer');
const { buildNQuerySnippet, chooseNQueryTarget } = require('../suiteql/nQueryInsert');

function getSuiteQLCommands(vscode, services) {
    return {
        'netsuite.createSuiteQLQuery': () => createSuiteQLQuery(vscode),
        'netsuite.extractSuiteQLToFile': () => extractSuiteQLToFile(vscode),
        'netsuite.insertSuiteQLAsNQuery': () => insertSuiteQLAsNQuery(vscode),
        'netsuite.createSuiteQLSchema': () => createSuiteQLSchema(vscode, services)
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
        vscode.window.showInformationMessage('Opened an untitled SuiteQL file.');
        return;
    }

    const target = vscode.Uri.file(path.join(folder.uri.fsPath, fileName));
    await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(target));
    vscode.window.showInformationMessage(`Created ${fileName}.`);
}

async function extractSuiteQLToFile(vscode) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Open a JavaScript file with an embedded SuiteQL query.');
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
        vscode.window.showInformationMessage('Opened the extracted SuiteQL in an untitled file.');
        return;
    }

    const target = vscode.Uri.file(path.join(folder.uri.fsPath, fileName));
    await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(target));
    vscode.window.showInformationMessage(`Extracted SuiteQL to ${fileName}.`);
}

async function insertSuiteQLAsNQuery(vscode) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Open a SuiteQL file or select a query in a JavaScript file.');
        return;
    }

    const queryText = editor.document.languageId === 'suiteql' || editor.document.languageId === 'sql'
        ? editor.document.getText().trim()
        : editor.document.getText(editor.selection).trim();
    if (!queryText) {
        vscode.window.showWarningMessage('No SuiteQL text to insert. Select a query, or open a .suiteql file.');
        return;
    }

    const visible = vscode.window.visibleTextEditors || [];
    const editors = visible.map((item) => ({ languageId: item.document.languageId, editor: item }));
    let activeIndex = visible.indexOf(editor);
    if (activeIndex < 0) {
        editors.unshift({ languageId: editor.document.languageId, editor });
        activeIndex = 0;
    }
    const targetChoice = chooseNQueryTarget(editors, activeIndex);
    if (targetChoice.type === 'none' || targetChoice.type === 'unsupported') {
        vscode.window.showWarningMessage('Open a SuiteQL file or a JavaScript file to insert an N/query block.');
        return;
    }

    let target = editor;
    let message = 'Inserted N/query block.';
    if (targetChoice.type === 'existing') {
        target = editors[targetChoice.index].editor;
        await vscode.window.showTextDocument(target.document, { viewColumn: target.viewColumn, preserveFocus: false });
        target = vscode.window.activeTextEditor || target;
        message = 'Inserted N/query block into the open JavaScript file.';
    } else if (targetChoice.type === 'untitled') {
        const document = await vscode.workspace.openTextDocument({ language: 'javascript', content: '' });
        target = await vscode.window.showTextDocument(document);
        message = 'Inserted N/query block into a new JavaScript document.';
    }

    const inserted = await target.insertSnippet(new vscode.SnippetString(buildNQuerySnippet(queryText)));
    if (inserted === false) {
        vscode.window.showErrorMessage('Could not insert the N/query block.');
        return;
    }
    vscode.window.showInformationMessage(message);
}

async function createSuiteQLSchema(vscode, { extensionPath }) {
    const folder = await pickFolder(vscode, 'Select workspace folder for SuiteQL schema file');
    if (!folder) {
        vscode.window.showWarningMessage('Open a workspace folder first.');
        return;
    }

    const targetPath = getSchemaPath(vscode, vscode.Uri.file(folder.uri.fsPath));
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(path.join(extensionPath, 'resources', 'netsuite-suiteql-schema.example.json'), targetPath);
        vscode.window.showInformationMessage('Created the SuiteQL schema example.');
    } else {
        vscode.window.showInformationMessage('Opened the existing SuiteQL schema file.');
    }
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(targetPath));
}

module.exports = {
    getSuiteQLCommands
};
