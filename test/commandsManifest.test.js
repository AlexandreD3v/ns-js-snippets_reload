const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { collectCommandHandlers } = require('../src/commands/registerCommands');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const declared = packageJson.contributes.commands.map((item) => item.command).sort();

const vscode = {
    commands: {
        registerCommand: () => ({ dispose: () => {} })
    },
    window: {
        showErrorMessage: () => undefined,
        showWarningMessage: () => undefined,
        showInformationMessage: () => undefined
    }
};

const services = {
    data: {
        modules: [],
        entryPoints: {},
        governance: {},
        suiteqlTables: []
    },
    extensionPath: path.join(__dirname, '..'),
    context: { subscriptions: [] },
    outputChannel: { appendLine: () => {}, show: () => {} },
    customFieldStore: {
        get: () => ({ allFields: [], byRecordType: {} }),
        reload: () => []
    }
};

const registered = Object.keys(collectCommandHandlers(vscode, services)).sort();
assert.deepStrictEqual(
    declared,
    registered,
    `package.json commands must match registered handlers.\nMissing handlers: ${declared.filter((id) => !registered.includes(id)).join(', ')}\nExtra handlers: ${registered.filter((id) => !declared.includes(id)).join(', ')}`
);

for (const command of packageJson.contributes.commands) {
    assert.ok(!command.title.startsWith('NetSuite:'), `${command.command} title should not repeat the category prefix`);
}

console.log(`Command manifest tests passed (${declared.length} commands).`);
