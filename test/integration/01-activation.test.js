'use strict';

const assert = require('assert');
const vscode = require('vscode');
const {
    EXTENSION_ID,
    record,
    installUiHarness,
    check
} = require('./support');

describe('ativação', () => {
    it('ativa a extensão sem erro e sem diálogo de avaliação', async () => {
        const extension = vscode.extensions.getExtension(EXTENSION_ID);
        assert.ok(extension, `extensão ${EXTENSION_ID} não foi encontrada no host`);
        assert.strictEqual(extension.id, EXTENSION_ID);
        assert.strictEqual(extension.packageJSON.publisher, 'alexandrejcorrea');
        assert.strictEqual(extension.packageJSON.name, 'ns-js-snippets-reload');
        assert.strictEqual(extension.packageJSON.version, '0.7.1');

        if (extension.isActive) {
            await check('ativação da extensão', async () => {
                await extension.activate();
                assert.strictEqual(extension.isActive, true);
                return `já estava ativa no host de teste (VS Code ${vscode.version}); activate() resolveu de novo`;
            });
            record(
                'lembrete de avaliação na ativação',
                'passou',
                'a extensão já estava ativa e o host não ficou bloqueado num diálogo'
            );
            return;
        }

        const harness = installUiHarness(vscode);
        try {
            await check('ativação da extensão', async () => {
                const started = Date.now();
                await extension.activate();
                assert.strictEqual(extension.isActive, true);
                return `ativou em ${Date.now() - started} ms no VS Code ${vscode.version}, ExtensionMode.Test`;
            });
            await check('lembrete de avaliação na ativação', async () => {
                const prompt = harness.calls.find((call) => /Enjoying NetSuite/.test(call.text));
                assert.ok(!prompt, `o lembrete apareceu durante activate(): ${JSON.stringify(harness.calls)}`);
                assert.strictEqual(harness.opened.length, 0);
                return 'activate() não mostrou o lembrete nem abriu o Marketplace no modo de teste';
            });
        } finally {
            harness.restore();
        }
    });
});
