const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { addModuleImport } = require('../src/analysis/importManager');
const { buildJestTestContent } = require('../src/commands/intelligenceCommands');
const { registerCommands } = require('../src/commands/registerCommands');
const { fillScriptRecordUrl } = require('../src/commands/suitecloudCommands');
const { LM_TOOL_NAMES } = require('../src/ai/lmTools');
const { buildIndex, findFieldDefinitionFiles, findScriptObjectForFile, resolveScriptFilePath } = require('../src/sdf/sdfIndex');
const { buildNQuerySnippet, chooseNQueryTarget, escapeQueryForJsTemplate, escapeSnippetText } = require('../src/suiteql/nQueryInsert');

function testImports() {
    const arrow = [
        'define([',
        "    'N/record'",
        '], (record) => {',
        "    record.load({ type: 'salesorder' });",
        '});',
        ''
    ].join('\n');
    const added = addModuleImport(arrow, 'N/log', 'log');
    assert.strictEqual(added.status, 'added');
    assert.strictEqual(added.alias, 'log');
    assert.ok(added.code.includes("'N/log'"));
    assert.ok(added.code.includes('(record, log) =>'));
    assert.ok(added.code.includes("record.load({ type: 'salesorder' });"));

    const again = addModuleImport(added.code, 'N/log', 'log');
    assert.strictEqual(again.status, 'exists');

    const single = 'define(["N/record"], record => {\n    return record;\n});\n';
    const singleResult = addModuleImport(single, 'N/log', 'log');
    assert.ok(singleResult.code.includes('(record, log) =>'));
    assert.ok(singleResult.code.includes('"N/log"'));

    const classic = 'define(["N/record"], function (record) {\n    return record;\n});\n';
    const classicResult = addModuleImport(classic, 'N/log', 'log');
    assert.ok(classicResult.code.includes('function (record, log)'));
    assert.ok(classicResult.code.includes('"N/log"'));

    assert.strictEqual(addModuleImport('const value = 1;\n', 'N/log', 'log').status, 'unsupported');
}

function testSuiteQLInsert() {
    const query = [
        "SELECT '$1' AS label",
        'FROM customer',
        'WHERE name = `literal` AND note = ${note}'
    ].join('\n');
    const snippet = buildNQuerySnippet(query);
    assert.ok(snippet.includes(escapeSnippetText(`        ${escapeQueryForJsTemplate(query.split('\n')[0])}`)));
    assert.deepStrictEqual(snippet.replace(/\\\$/g, '').match(/\$\d+/g), ['$1', '$0']);
    assert.strictEqual(chooseNQueryTarget([{ languageId: 'suiteql' }, { languageId: 'javascript' }], 0).type, 'existing');
    assert.strictEqual(chooseNQueryTarget([{ languageId: 'suiteql' }], 0).type, 'untitled');
    assert.strictEqual(chooseNQueryTarget([{ languageId: 'javascript' }], 0).type, 'active');
}

function testScriptPathsAndFields() {
    assert.strictEqual(
        resolveScriptFilePath('/proj/src', '/proj/src/FileCabinet', '/SuiteScripts/ue.js'),
        path.join('/proj/src/FileCabinet', 'SuiteScripts', 'ue.js')
    );
    assert.strictEqual(
        resolveScriptFilePath('/proj/src', '/proj/src/FileCabinet', '/FileCabinet/SuiteScripts/ue.js'),
        path.join('/proj/src', 'FileCabinet', 'SuiteScripts', 'ue.js')
    );

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-sdf-'));
    fs.writeFileSync(path.join(root, 'suitecloud.config.js'), "module.exports = { defaultProjectFolder: 'src' };\n");
    const objects = path.join(root, 'src', 'Objects');
    const scripts = path.join(root, 'src', 'FileCabinet', 'SuiteScripts');
    fs.mkdirSync(objects, { recursive: true });
    fs.mkdirSync(scripts, { recursive: true });
    const scriptPath = path.join(scripts, 'ue_customer.js');
    fs.writeFileSync(scriptPath, 'define([], function () { return {}; });\n');
    fs.writeFileSync(path.join(objects, 'customscript_ue.xml'), [
        '<usereventscript scriptid="customscript_ue">',
        '  <scriptid>customscript_ue</scriptid>',
        '  <scriptfile>[/SuiteScripts/ue_customer.js]</scriptfile>',
        '  <description>uses custbody_only_mentioned</description>',
        '</usereventscript>',
        ''
    ].join('\n'));
    fs.writeFileSync(path.join(objects, 'custbody_po_number.xml'), [
        '<transactionbodycustomfield scriptid="custbody_po_number">',
        '  <label>PO Number</label>',
        '</transactionbodycustomfield>',
        ''
    ].join('\n'));

    const index = buildIndex(root);
    const match = findScriptObjectForFile(index, scriptPath);
    assert.ok(match, 'script object should match the FileCabinet path');
    assert.strictEqual(path.resolve(match.scriptPath), path.resolve(scriptPath));
    assert.notStrictEqual(
        path.resolve(match.scriptPath),
        path.resolve(root, 'src', 'SuiteScripts', 'ue_customer.js')
    );

    const definitions = findFieldDefinitionFiles(index, 'custbody_po_number');
    assert.strictEqual(definitions.length, 1);
    assert.ok(definitions[0].objectPath.endsWith(`${path.sep}custbody_po_number.xml`));
    const mentioned = findFieldDefinitionFiles(index, 'custbody_only_mentioned');
    assert.strictEqual(mentioned.length, 1);
    assert.ok(mentioned[0].objectPath.endsWith(`${path.sep}customscript_ue.xml`));
    fs.rmSync(root, { recursive: true, force: true });
}

function testUrlsJestAndRegistration() {
    assert.strictEqual(
        fillScriptRecordUrl('https://acct.app.netsuite.com/app/common/scripting/script.nl?id={scriptId}', '123 4'),
        'https://acct.app.netsuite.com/app/common/scripting/script.nl?id=123%204'
    );
    assert.strictEqual(fillScriptRecordUrl('https://example.test/script?id={id}', '9'), 'https://example.test/script?id=9');
    assert.strictEqual(fillScriptRecordUrl('https://example.test/script', '9'), null);

    const jestContent = buildJestTestContent(
        path.join('FileCabinet', 'SuiteScripts', 'userEvent.js'),
        '/** @NScriptType UserEventScript */'
    );
    assert.ok(!jestContent.includes('${'));
    assert.match(jestContent, /require\('\.\.\/userEvent'\)/);
    assert.match(jestContent, /userEvent usereventscript/);

    const suitecloudSource = fs.readFileSync(path.join(__dirname, '../src/commands/suitecloudCommands.js'), 'utf8');
    assert.ok(suitecloudSource.includes("runInteractiveSuiteCloud"));
    assert.ok(!suitecloudSource.includes("runProjectCommand(vscode, services, ['account:setup'"));
    assert.ok(!suitecloudSource.includes("runProjectCommand(vscode, services, ['file:import'"));

    const pkg = require('../package.json');
    const vscode = {
        commands: {
            registerCommand() {
                return { dispose() {} };
            }
        }
    };
    const context = { subscriptions: [] };
    const ids = registerCommands(vscode, context, {
        data: { modules: [] },
        outputChannel: { appendLine() {}, show() {}, clear() {} },
        context,
        customFieldStore: {},
        extensionPath: path.join(__dirname, '..')
    });
    const contributed = pkg.contributes.commands.map((command) => command.command).sort();
    assert.deepStrictEqual([...ids].sort(), contributed);
    for (const group of Object.values(pkg.contributes.menus)) {
        for (const item of group) {
            assert.ok(contributed.includes(item.command), item.command);
        }
    }
    assert.ok(pkg.activationEvents.includes('onLanguage:javascript'));
    assert.ok(pkg.activationEvents.includes('onLanguage:suiteql'));
    const snippetLanguages = pkg.contributes.snippets.map((item) => item.language).sort();
    assert.deepStrictEqual(snippetLanguages, ['javascript', 'javascriptreact', 'typescript', 'typescriptreact']);
    for (const item of pkg.contributes.snippets) {
        assert.strictEqual(item.path, './snippets/snippets.code-snippets');
    }
    const paletteByCommand = new Map(pkg.contributes.menus.commandPalette.map((item) => [item.command, item]));
    for (const command of pkg.contributes.commands) {
        assert.strictEqual(command.category, 'NetSuite', command.command);
        assert.ok(
            !command.title.toLowerCase().startsWith('netsuite'),
            `${command.command} repete a categoria no título: ${command.title}`
        );
        const label = `${command.category}: ${command.title}`;
        assert.strictEqual(label.indexOf('NetSuite:'), 0, label);
        assert.strictEqual(label.indexOf('NetSuite:', 'NetSuite:'.length), -1, label);
        const menu = paletteByCommand.get(command.command);
        assert.ok(menu, command.command);
        if (command.command === 'netsuite.debugShowRatingPrompt') {
            assert.strictEqual(menu.when, 'config.netsuite.debugRatingPrompt');
        } else {
            assert.ok(!menu.when, `${command.command} ficou oculto na paleta`);
        }
    }
    assert.strictEqual(pkg.contributes.configuration.properties['netsuite.debugRatingPrompt'].default, false);
    assert.strictEqual(pkg.name, 'ns-js-snippets-reload');
    assert.strictEqual(pkg.displayName, 'SuiteScript Toolkit for NetSuite');
    assert.strictEqual(pkg.version, '0.7.1');
    assert.strictEqual(pkg.license, 'GPL-3.0-only');
    assert.strictEqual(pkg.homepage, 'https://github.com/AlexandreD3v/ns-js-snippets_reload#readme');
    assert.strictEqual(pkg.bugs.url, 'https://github.com/AlexandreD3v/ns-js-snippets_reload/issues');
    assert.match(pkg.description, /toolkit/i);
    for (const keyword of ['netsuite', 'suitescript', 'suiteql', 'sdf', 'suitecloud']) {
        assert.ok(pkg.keywords.includes(keyword), keyword);
    }
    assert.deepStrictEqual(pkg.categories, ['Snippets', 'Programming Languages', 'Linters']);
    assert.ok(pkg.devDependencies['@vscode/vsce']);
    assert.strictEqual(pkg.devDependencies.vsce, undefined);
    const ignore = fs.readFileSync(path.join(__dirname, '../.vscodeignore'), 'utf8');
    const gitignore = fs.readFileSync(path.join(__dirname, '../.gitignore'), 'utf8');
    for (const pattern of ['**/*.vsix', '**/*.map', 'test/**', 'docs/**', '.github/**']) {
        assert.ok(ignore.includes(pattern), pattern);
    }
    assert.match(gitignore, /^\*\.vsix$/m);
    assert.strictEqual(fs.existsSync(path.join(__dirname, '../ns-js-snippets-reload-0.1.0.vsix')), false);
    assert.strictEqual(fs.existsSync(path.join(__dirname, '../ns-js-snippets-reload-0.1.1.vsix')), false);
    const toolNames = pkg.contributes.languageModelTools.map((tool) => tool.name).sort();
    assert.deepStrictEqual(toolNames, [...LM_TOOL_NAMES].sort());
    for (const tool of pkg.contributes.languageModelTools) {
        assert.ok(tool.displayName);
        assert.ok(tool.modelDescription);
        assert.strictEqual(tool.inputSchema.type, 'object');
    }
}

testImports();
testSuiteQLInsert();
testScriptPathsAndFields();
testUrlsJestAndRegistration();
console.log('Toolkit tests passed.');
