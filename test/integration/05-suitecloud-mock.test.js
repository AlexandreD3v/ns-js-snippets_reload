'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const {
    EXTENSION_ID,
    check,
    installUiHarness,
    invokeCommand,
    commandFailure,
    messageText,
    sleep,
    workspacePath,
    flushReport,
    assertNoUnhandledRejections
} = require('./support');

const ALLOWED_ARGUMENTS = new Set([
    '--version',
    'project:validate',
    'project:deploy',
    'file:upload',
    'object:import',
    'account:setup',
    'file:import',
    'project:create',
    'proxy:generatekey'
]);

function readLog() {
    const logFile = process.env.NS_FAKE_SUITECLOUD_LOG;
    if (!logFile || !fs.existsSync(logFile)) {
        return [];
    }
    return fs.readFileSync(logFile, 'utf8')
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
}

function assertFakeEntries(entries) {
    assert.ok(entries.length > 0, 'a CLI falsa não foi executada');
    for (const entry of entries) {
        assert.ok(
            String(entry.script).endsWith(`${path.sep}fake-suitecloud.js`),
            `processo que não é a CLI falsa: ${JSON.stringify(entry)}`
        );
        assert.ok(ALLOWED_ARGUMENTS.has(entry.argv[0]), `argumento inesperado: ${entry.argv.join(' ')}`);
        const blob = JSON.stringify(entry);
        assert.ok(!/netsuite\.com/i.test(blob), blob);
        assert.ok(!/https?:\/\//i.test(blob), blob);
    }
}

async function waitForArg(argument, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (readLog().some((entry) => entry.argv[0] === argument)) {
            return true;
        }
        await sleep(200);
    }
    return false;
}

function writeProject(root) {
    const scripts = path.join(root, 'src', 'FileCabinet', 'SuiteScripts');
    const objects = path.join(root, 'src', 'Objects');
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(objects, { recursive: true });
    fs.writeFileSync(
        path.join(root, 'suitecloud.config.js'),
        "module.exports = { defaultProjectFolder: 'src' };\n"
    );
    fs.writeFileSync(
        path.join(root, 'src', 'manifest.xml'),
        '<manifest projecttype="ACCOUNTCUSTOMIZATION"></manifest>\n'
    );
    fs.writeFileSync(path.join(root, 'src', 'deploy.xml'), '<deploy></deploy>\n');
    fs.writeFileSync(
        path.join(root, 'project.json'),
        `${JSON.stringify({ defaultAuthId: '1234567_SB1' }, null, 2)}\n`
    );
    const scriptPath = path.join(scripts, 'hello.js');
    fs.writeFileSync(scriptPath, [
        '/**',
        ' * @NApiVersion 2.1',
        ' * @NScriptType UserEventScript',
        ' */',
        'define([], function () {',
        '    return { beforeLoad: function beforeLoad() {} };',
        '});',
        ''
    ].join('\n'));
    fs.writeFileSync(path.join(objects, 'customscript_hello.xml'), [
        '<usereventscript scriptid="customscript_hello">',
        '  <scriptid>customscript_hello</scriptid>',
        '  <scriptfile>[/SuiteScripts/hello.js]</scriptfile>',
        '</usereventscript>',
        ''
    ].join('\n'));
    return scriptPath;
}

describe('SuiteCloud com CLI falsa', () => {
    let harness;
    let scriptPath;

    before(async () => {
        await vscode.extensions.getExtension(EXTENSION_ID).activate();
        fs.chmodSync(process.env.NS_FAKE_SUITECLOUD_BIN, 0o755);
        fs.writeFileSync(process.env.NS_FAKE_SUITECLOUD_LOG, '');
        const root = workspacePath(vscode);
        scriptPath = writeProject(root);
        await vscode.workspace.getConfiguration('netsuite').update(
            'suitecloudPath',
            process.env.NS_FAKE_SUITECLOUD_BIN,
            vscode.ConfigurationTarget.Workspace
        );
        const configured = vscode.workspace.getConfiguration('netsuite').get('suitecloudPath');
        assert.strictEqual(configured, process.env.NS_FAKE_SUITECLOUD_BIN);
        harness = installUiHarness(vscode);
    });

    after(async () => {
        if (harness) {
            harness.restore();
        }
        for (const terminal of vscode.window.terminals.slice()) {
            terminal.dispose();
        }
        await sleep(300);
        flushReport();
        assertNoUnhandledRejections();
    });

    async function run(command, feature, assertResult, prepare) {
        await check(feature, async () => {
            harness.reset();
            if (prepare) {
                await prepare();
            }
            const error = await invokeCommand(vscode, command);
            assert.ok(!error, error && error.stack);
            const failed = commandFailure(harness.calls);
            assert.ok(!failed, failed && failed.text);
            await assertResult();
            return messageText(harness.calls);
        });
    }

    it('project:validate só chama a CLI falsa', async () => {
        await run('netsuite.suitecloudValidate', 'comando netsuite.suitecloudValidate — CLI falsa', async () => {
            assert.ok(readLog().some((entry) => entry.argv[0] === 'project:validate'));
            assert.match(messageText(harness.calls), /Validate project completed/);
        });
    });

    it('project:deploy valida antes e não sai da CLI falsa', async () => {
        await run('netsuite.suitecloudDeploy', 'comando netsuite.suitecloudDeploy — CLI falsa', async () => {
            const entries = readLog();
            assert.ok(entries.some((entry) => entry.argv[0] === 'project:validate'));
            const deploy = entries.find((entry) => entry.argv[0] === 'project:deploy');
            assert.ok(deploy, JSON.stringify(entries.map((entry) => entry.argv)));
            assert.deepStrictEqual(deploy.argv.slice(1), ['--accountspecificvalues', 'WARNING']);
            assert.match(messageText(harness.calls), /1234567_SB1" \(sandbox\)/);
            assert.match(messageText(harness.calls), /Deploy project completed/);
        }, () => {
            harness.setMessage('Deploy');
        });
    });

    it('deploy cancelado não chama project:deploy', async () => {
        const before = readLog().length;
        await run('netsuite.suitecloudDeploy', 'deploy cancelado fica na conta sandbox', async () => {
            const added = readLog().slice(before);
            assert.ok(
                added.every((entry) => entry.argv[0] === '--version'),
                JSON.stringify(added.map((entry) => entry.argv))
            );
            const text = messageText(harness.calls);
            assert.match(text, /1234567_SB1" \(sandbox\)/);
            assert.ok(!text.includes('Validation failed'), text);
            assert.ok(!text.includes('Deploy project completed'), text);
        });
    });

    it('deploy sem CLI não culpa a validação', async () => {
        const before = readLog().length;
        const config = vscode.workspace.getConfiguration('netsuite');
        await config.update(
            'suitecloudPath',
            process.env.NS_MISSING_SUITECLOUD,
            vscode.ConfigurationTarget.Workspace
        );
        try {
            await run('netsuite.suitecloudDeploy', 'deploy sem CLI não fala em validação', async () => {
                const text = messageText(harness.calls);
                assert.match(text, /SuiteCloud CLI was not found/);
                assert.ok(!text.includes('Validation failed'), text);
                assert.ok(!text.includes('1234567_SB1'), text);
                assert.strictEqual(readLog().length, before);
            });
        } finally {
            await config.update(
                'suitecloudPath',
                process.env.NS_FAKE_SUITECLOUD_BIN,
                vscode.ConfigurationTarget.Workspace
            );
        }
    });

    it('sandbox não pede confirmação quando a setting está desligada', async () => {
        const before = readLog().length;
        const config = vscode.workspace.getConfiguration('netsuite');
        await config.update('suitecloudAlwaysConfirmAccount', false, vscode.ConfigurationTarget.Workspace);
        try {
            await run('netsuite.suitecloudDeploy', 'sandbox sem confirmação extra', async () => {
                const text = messageText(harness.calls);
                assert.ok(!/1234567_SB1/.test(text), text);
                const added = readLog().slice(before);
                assert.ok(added.some((entry) => entry.argv[0] === 'project:deploy'));
            });
        } finally {
            await config.update('suitecloudAlwaysConfirmAccount', true, vscode.ConfigurationTarget.Workspace);
        }
    });

    it('produção continua pedindo confirmação explícita com a setting desligada', async () => {
        const projectFile = path.join(workspacePath(vscode), 'project.json');
        const original = fs.readFileSync(projectFile, 'utf8');
        const before = readLog().length;
        const config = vscode.workspace.getConfiguration('netsuite');
        await config.update('suitecloudAlwaysConfirmAccount', false, vscode.ConfigurationTarget.Workspace);
        try {
            await run('netsuite.suitecloudDeploy', 'produção pede confirmação mesmo com a setting desligada', async () => {
                const text = messageText(harness.calls);
                assert.match(text, /PRODUCTION account "acme_prod"/);
                assert.ok(!text.includes('Deploy project completed'), text);
                const added = readLog().slice(before);
                assert.ok(added.every((entry) => entry.argv[0] === '--version'), JSON.stringify(added));
            }, () => {
                fs.writeFileSync(projectFile, `${JSON.stringify({ defaultAuthId: 'acme_prod' })}\n`);
            });
        } finally {
            fs.writeFileSync(projectFile, original);
            await config.update('suitecloudAlwaysConfirmAccount', true, vscode.ConfigurationTarget.Workspace);
        }
    });

    it('file:upload usa o caminho do File Cabinet com barra inicial', async () => {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(scriptPath));
        await vscode.window.showTextDocument(document, { preview: false });
        await run('netsuite.suitecloudUpload', 'comando netsuite.suitecloudUpload — CLI falsa', async () => {
            const upload = readLog().find((entry) => entry.argv[0] === 'file:upload');
            assert.ok(upload, JSON.stringify(readLog().map((entry) => entry.argv)));
            const pathsFlag = upload.argv.indexOf('--paths');
            assert.strictEqual(upload.argv[pathsFlag + 1], '/SuiteScripts/hello.js');
            assert.match(messageText(harness.calls), /1234567_SB1" \(sandbox\)/);
            assert.match(messageText(harness.calls), /Upload active file completed/);
        }, () => {
            harness.setMessage('Upload');
        });
    });

    it('object:import recebe o script id digitado e para na CLI falsa', async () => {
        await run('netsuite.suitecloudImportObject', 'comando netsuite.suitecloudImportObject — CLI falsa', async () => {
            const imported = readLog().find((entry) => entry.argv[0] === 'object:import');
            assert.ok(imported, JSON.stringify(readLog().map((entry) => entry.argv)));
            assert.ok(imported.argv.includes('customscript_hello'), imported.argv.join(' '));
            assert.match(messageText(harness.calls), /Import SDF object completed/);
        }, () => {
            harness.setInput('customscript_hello');
        });
    });

    it('abre o objeto SDF relacionado sem chamar a CLI', async () => {
        const before = readLog().length;
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(scriptPath));
        await vscode.window.showTextDocument(document, { preview: false });
        await run(
            'netsuite.suitecloudOpenRelatedObject',
            'comando netsuite.suitecloudOpenRelatedObject — índice SDF local',
            async () => {
                assert.strictEqual(readLog().length, before);
                assert.match(messageText(harness.calls), /Opened SDF object customscript_hello/);
                assert.ok(vscode.window.activeTextEditor.document.uri.fsPath.endsWith('customscript_hello.xml'));
            }
        );
    });

    async function runInteractive(command, feature, argument, feedback) {
        await run(command, feature, async () => {
            assert.match(messageText(harness.calls), feedback);
            const seen = await waitForArg(argument, 10000);
            assert.ok(seen, `a CLI falsa não registrou ${argument}. Log: ${JSON.stringify(readLog())}`);
        });
    }

    it('account:setup roda no terminal pela CLI falsa', async () => {
        await runInteractive(
            'netsuite.suitecloudAccountSetup',
            'comando netsuite.suitecloudAccountSetup — CLI falsa',
            'account:setup',
            /Account setup is running in the integrated terminal/
        );
    });

    it('file:import roda no terminal pela CLI falsa', async () => {
        await runInteractive(
            'netsuite.suitecloudImportFile',
            'comando netsuite.suitecloudImportFile — CLI falsa',
            'file:import',
            /Import file is running in the integrated terminal/
        );
    });

    it('project:create roda no terminal pela CLI falsa', async () => {
        await runInteractive(
            'netsuite.suitecloudCreateProject',
            'comando netsuite.suitecloudCreateProject — CLI falsa',
            'project:create',
            /Create project is running in the integrated terminal/
        );
    });

    it('a geração de chave do Developer Assistant não chama o NetSuite', async () => {
        await runInteractive(
            'netsuite.configureDeveloperAssistant',
            'comando netsuite.configureDeveloperAssistant — CLI falsa',
            'proxy:generatekey',
            /Developer Assistant key generation is running in the integrated terminal/
        );
    });

    it('toda invocação registrada ficou na CLI falsa', async () => {
        await check('isolamento de rede/SDF/CLI', async () => {
            const entries = readLog();
            assertFakeEntries(entries);
            const heads = [...new Set(entries.map((entry) => entry.argv[0]))].sort();
            return heads.join(', ');
        });
    });
});
