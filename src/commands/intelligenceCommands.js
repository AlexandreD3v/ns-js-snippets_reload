const path = require('path');
const { addModuleImport } = require('../analysis/importManager');
const { buildIndex, findFieldDefinitions, findScriptObjectForFile } = require('../sdf/sdfIndex');
const { findSuiteCloudProjectRoot } = require('../services/suitecloudRunner');
const { getSchemaPath, loadSchema } = require('../suiteql/schema');

function getIntelligenceCommands(vscode, services) {
    return {
        'netsuite.addModuleImport': () => addModuleImportCommand(vscode, services),
        'netsuite.goToFieldDefinition': () => goToFieldDefinition(vscode, services),
        'netsuite.scaffoldJestTest': () => scaffoldJestTest(vscode, services)
    };
}

async function addModuleImportCommand(vscode, services) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'javascript') {
        vscode.window.showWarningMessage('Open a JavaScript SuiteScript file.');
        return;
    }

    const modulePath = await vscode.window.showQuickPick(
        services.data.modules.map((item) => item.label),
        { placeHolder: 'Select N/* module to add' }
    );
    if (!modulePath) {
        return;
    }

    const alias = modulePath.split('/').pop();
    const updated = addModuleImport(editor.document.getText(), modulePath, alias);
    const fullRange = new vscode.Range(0, 0, editor.document.lineCount, 0);
    await editor.edit((editBuilder) => editBuilder.replace(fullRange, updated));
}

async function goToFieldDefinition(vscode, services) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active, /cust[a-z0-9_]+/i);
    if (!wordRange) {
        vscode.window.showWarningMessage('Place the cursor on a cust* identifier.');
        return;
    }

    const word = editor.document.getText(wordRange).toLowerCase();
    const root = findSuiteCloudProjectRoot(vscode, editor.document.uri);
    if (root) {
        const index = buildIndex(root);
        const definitions = findFieldDefinitions(index, word);
        if (definitions.length > 0) {
            await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(definitions[0].objectPath));
            return;
        }
    }

    const schema = loadSchema(vscode, editor.document.uri);
    for (const [table, columns] of Object.entries(schema.columns)) {
        if (columns.map((item) => item.toLowerCase()).includes(word)) {
            vscode.window.showInformationMessage(`Column ${word} is defined for SuiteQL table "${table}" in local schema.`);
            const schemaPath = getSchemaPath(vscode, editor.document.uri);
            if (schemaPath) {
                await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(schemaPath));
            }
            return;
        }
    }

    vscode.window.showWarningMessage(`No local SDF or schema definition found for ${word}.`);
}

async function scaffoldJestTest(vscode, services) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const scriptType = require('../utils/parseSuiteScript').detectScriptType(editor.document.getText()) || 'script';
    const baseName = path.basename(editor.document.fileName, '.js');
    const content = [
        "const entryPoint = require('../${1:./" + baseName + "}');",
        '',
        "jest.mock('N/log', () => ({ debug: jest.fn(), error: jest.fn() }));",
        "jest.mock('N/record', () => ({ load: jest.fn(), create: jest.fn() }));",
        '',
        `describe('${baseName} ${scriptType}', () => {`,
        "    test('TODO: add entry point test', () => {",
        '        expect(true).toBe(true);',
        '    });',
        '});',
        ''
    ].join('\n');

    const target = vscode.Uri.file(path.join(path.dirname(editor.document.uri.fsPath), '__tests__', `${baseName}.test.js`));
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(target.fsPath)));
    await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(target));
}

module.exports = {
    getIntelligenceCommands
};
