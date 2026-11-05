'use strict';

const assert = require('assert');
const fs = require('fs');
const vscode = require('vscode');
const { noEditorCases, followUpCases, assertCaseResult, messages } = require('./commandCases');
const {
    EXTENSION_ID,
    installUiHarness,
    invokeCommand,
    commandFailure,
    check,
    messageText,
    clearFakeLog,
    removeSuiteCloudProject,
    closeEditors,
    workspacePath
} = require('./support');

describe('comandos', () => {
    let harness;

    before(async () => {
        clearFakeLog();
        const extension = vscode.extensions.getExtension(EXTENSION_ID);
        await extension.activate();
        removeSuiteCloudProject(workspacePath(vscode));
        await closeEditors(vscode);
        await vscode.workspace.getConfiguration('netsuite').update(
            'suitecloudPath',
            process.env.NS_MISSING_SUITECLOUD,
            vscode.ConfigurationTarget.Workspace
        );
        await vscode.workspace.getConfiguration('netsuite').update(
            'scriptRecordUrlTemplate',
            '',
            vscode.ConfigurationTarget.Workspace
        );
        const configured = vscode.workspace.getConfiguration('netsuite').get('suitecloudPath');
        assert.strictEqual(configured, process.env.NS_MISSING_SUITECLOUD);
        assert.ok(!fs.existsSync(configured), `o caminho de CLI de teste não deveria existir: ${configured}`);
        harness = installUiHarness(vscode);
    });

    after(() => {
        if (harness) {
            harness.restore();
        }
        const logFile = process.env.NS_FAKE_SUITECLOUD_LOG;
        if (logFile && fs.existsSync(logFile) && fs.readFileSync(logFile, 'utf8').trim()) {
            throw new Error(`A CLI falsa rodou nos cenários sem configuração:\n${fs.readFileSync(logFile, 'utf8')}`);
        }
    });

    it('registra todos os comandos de contributes.commands', async () => {
        await check('registro dos comandos contribuídos', async () => {
            assert.ok(!vscode.window.activeTextEditor, 'um editor abriu antes dos cenários sem arquivo');
            const declared = vscode.extensions.getExtension(EXTENSION_ID).packageJSON.contributes.commands
                .map((command) => command.command);
            const registered = new Set(await vscode.commands.getCommands(true));
            const missing = declared.filter((command) => !registered.has(command));
            assert.deepStrictEqual(missing, []);
            const covered = new Set([...noEditorCases, ...followUpCases].map((spec) => spec.id));
            const untested = declared.filter((command) => !covered.has(command));
            assert.deepStrictEqual(untested, [], `comandos sem cenário: ${untested.join(', ')}`);
            return `${declared.length} comandos registrados e cobertos`;
        });
    });

    it('não repete NetSuite no título da paleta', async () => {
        await check('títulos da paleta sem categoria duplicada', async () => {
            const manifest = vscode.extensions.getExtension(EXTENSION_ID).packageJSON;
            const palette = new Map(manifest.contributes.menus.commandPalette.map((item) => [item.command, item]));
            const labels = [];
            for (const command of manifest.contributes.commands) {
                assert.strictEqual(command.category, 'NetSuite', command.command);
                assert.ok(
                    !command.title.toLowerCase().startsWith('netsuite'),
                    `${command.command} repete a categoria no título: ${command.title}`
                );
                const label = `${command.category}: ${command.title}`;
                assert.strictEqual(label.indexOf('NetSuite:', 'NetSuite:'.length), -1, label);
                labels.push(label);
                const menu = palette.get(command.command);
                assert.ok(menu, `${command.command} não está na paleta`);
                if (command.command === 'netsuite.debugShowRatingPrompt') {
                    assert.strictEqual(menu.when, 'config.netsuite.debugRatingPrompt');
                    assert.strictEqual(
                        manifest.contributes.configuration.properties['netsuite.debugRatingPrompt'].default,
                        false
                    );
                } else {
                    assert.ok(!menu.when, `${command.command} não aparece na busca NetSuite: ${menu.when}`);
                }
            }
            return `${labels.length} rótulos; Preview Rating Reminder fica oculto até netsuite.debugRatingPrompt`;
        });
    });

    describe('sem configuração', () => {
        for (const spec of noEditorCases) {
            it(`${spec.id} — ${spec.scenario}`, async () => {
                await runSpec(spec, true);
            });
        }
    });

    describe('efeito local, sem NetSuite', () => {
        for (const spec of followUpCases) {
            it(`${spec.id} — ${spec.scenario}`, async () => {
                await runSpec(spec, false);
            });
        }
    });

    async function runSpec(spec, requireNoEditor) {
        await check(`comando ${spec.id} — ${spec.scenario}`, async () => {
            harness.reset();
            if (requireNoEditor) {
                await closeEditors(vscode);
                assert.ok(
                    !vscode.window.activeTextEditor,
                    'havia um editor aberto e o cenário sem arquivo ficou inválido'
                );
            }
            if (spec.setup) {
                await spec.setup(harness, vscode);
            }
            const terminalsBefore = vscode.window.terminals.length;
            try {
                const invocationError = await invokeCommand(vscode, spec.id);
                assert.ok(!invocationError, invocationError && invocationError.stack);
                const failed = commandFailure(harness.calls);
                assert.ok(!failed, failed && failed.text);
                assert.strictEqual(
                    vscode.window.terminals.length,
                    terminalsBefore,
                    'o comando abriu um terminal sem CLI configurada'
                );
                if (!spec.allowExternal) {
                    assert.deepStrictEqual(harness.opened, [], `openExternal inesperado: ${harness.opened.join(', ')}`);
                }
                assertCaseResult(spec, vscode, harness);
                if (spec.assert) {
                    await spec.assert(vscode, harness);
                }
                return messageText(harness.calls) || messages(harness) || 'efeito local verificado, sem exceção';
            } finally {
                if (spec.cleanup) {
                    await spec.cleanup(vscode, harness);
                }
            }
        });
    }
});
