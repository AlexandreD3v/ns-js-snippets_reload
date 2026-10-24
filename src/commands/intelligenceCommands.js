const path = require('path');
const { addModuleImport } = require('../analysis/importManager');
const { buildIndex, findFieldDefinitionFiles } = require('../sdf/sdfIndex');
const { findSuiteCloudProjectRoot } = require('../services/suitecloudRunner');
const { getSchemaPath, loadSchema } = require('../suiteql/schema');
const { detectScriptType } = require('../utils/parseSuiteScript');

function getIntelligenceCommands(vscode, services) {
    return {
        'netsuite.addModuleImport': () => addModuleImportCommand(vscode, services),
        'netsuite.goToFieldDefinition': () => goToFieldDefinition(vscode, services),
        'netsuite.scaffoldJestTest': () => scaffoldJestTest(vscode)
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
    const result = addModuleImport(editor.document.getText(), modulePath, alias);
    if (result.status === 'exists') {
        vscode.window.showInformationMessage(`${modulePath} is already imported.`);
        return;
    }
    if (result.status === 'parse-error') {
        vscode.window.showErrorMessage(`Could not update imports: ${result.error}`);
        return;
    }
    if (result.status !== 'added' || result.code === editor.document.getText()) {
        vscode.window.showWarningMessage('Could not find a define([ ... ], function or arrow callback) to update.');
        return;
    }

    const document = editor.document;
    const lastLine = Math.max(document.lineCount - 1, 0);
    const endCharacter = document.lineAt(lastLine).text.length;
    const applied = await editor.edit((editBuilder) => {
        editBuilder.replace(new vscode.Range(0, 0, lastLine, endCharacter), result.code);
    });
    if (!applied) {
        vscode.window.showErrorMessage('Could not update the define() imports.');
        return;
    }
    vscode.window.showInformationMessage(`Imported ${modulePath} as ${result.alias}.`);
}

async function goToFieldDefinition(vscode) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Open a file and place the cursor on a cust* field id.');
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
        const matches = findFieldDefinitionFiles(buildIndex(root), word);
        if (matches.length === 1) {
            await openFieldFile(vscode, matches[0].objectPath, word);
            return;
        }
        if (matches.length > 1) {
            const pick = await vscode.window.showQuickPick(
                matches.map((item) => ({
                    label: path.basename(item.objectPath),
                    description: item.exact ? 'scriptid' : 'mention',
                    filePath: item.objectPath
                })),
                { placeHolder: `SDF definitions for ${word}` }
            );
            if (!pick) {
                return;
            }
            await openFieldFile(vscode, pick.filePath, word);
            return;
        }
    }

    const schema = loadSchema(vscode, editor.document.uri);
    for (const [table, columns] of Object.entries(schema.columns || {})) {
        if (!Array.isArray(columns)) {
            continue;
        }
        if (columns.map((item) => item.toLowerCase()).includes(word)) {
            vscode.window.showInformationMessage(`Column ${word} is defined for SuiteQL table "${table}" in the local schema.`);
            const schemaPath = getSchemaPath(vscode, editor.document.uri);
            if (schemaPath) {
                await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(schemaPath));
            }
            return;
        }
    }

    vscode.window.showWarningMessage(`No local SDF or schema definition found for ${word}.`);
}

async function openFieldFile(vscode, filePath, word) {
    const document = await vscode.workspace.openTextDocument(filePath);
    const fieldEditor = await vscode.window.showTextDocument(document);
    const index = document.getText().toLowerCase().indexOf(word.toLowerCase());
    if (index >= 0) {
        const start = document.positionAt(index);
        const end = document.positionAt(index + word.length);
        fieldEditor.selection = new vscode.Selection(start, end);
        fieldEditor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
    }
    vscode.window.showInformationMessage(`Opened SDF definition for ${word}.`);
}

function buildJestTestContent(scriptFileName, scriptSource) {
    const paths = buildJestTestPaths(scriptFileName);
    const scriptType = detectScriptType(scriptSource) || 'script';
    return [
        `const entryPoint = require(${jsString(paths.requirePath)});`,
        '',
        "jest.mock('N/log', () => ({ debug: jest.fn(), error: jest.fn() }));",
        "jest.mock('N/record', () => ({ load: jest.fn(), create: jest.fn() }));",
        '',
        `describe(${jsString(`${paths.baseName} ${scriptType}`)}, () => {`,
        "    test('TODO: add entry point test', () => {",
        '        expect(entryPoint).toBeDefined();',
        '    });',
        '});',
        ''
    ].join('\n');
}

function buildJestTestPaths(scriptFileName) {
    const directory = path.dirname(scriptFileName);
    const baseName = path.basename(scriptFileName, '.js');
    const inTests = path.basename(directory) === '__tests__';
    return {
        baseName,
        requirePath: inTests ? `./${baseName}` : `../${baseName}`,
        testPath: path.join(inTests ? directory : path.join(directory, '__tests__'), `${baseName}.test.js`)
    };
}

function jsString(value) {
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

async function scaffoldJestTest(vscode) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'javascript') {
        vscode.window.showWarningMessage('Open a JavaScript SuiteScript file to scaffold a Jest test.');
        return;
    }
    if (editor.document.uri.scheme !== 'file') {
        vscode.window.showWarningMessage('Save the script before scaffolding a Jest test.');
        return;
    }

    const paths = buildJestTestPaths(editor.document.uri.fsPath);
    const content = buildJestTestContent(editor.document.fileName, editor.document.getText());
    const target = vscode.Uri.file(paths.testPath);
    if (!(await confirmOverwrite(vscode, target))) {
        vscode.window.showInformationMessage('Existing Jest test was left unchanged.');
        return;
    }

    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(target.fsPath)));
    await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(target));
    vscode.window.showInformationMessage(`Jest test scaffold written to ${path.basename(path.dirname(target.fsPath))}/${path.basename(target.fsPath)}.`);
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

module.exports = {
    getIntelligenceCommands,
    buildJestTestContent,
    buildJestTestPaths
};
