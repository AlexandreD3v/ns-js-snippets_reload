'use strict';

const assert = require('assert');
const vscode = require('vscode');
const { EXTENSION_ID, check, sleep } = require('./support');

function toolText(result) {
    const parts = result && result.content ? result.content : [];
    return parts.map((part) => {
        if (typeof part === 'string') {
            return part;
        }
        return part.value || part.text || '';
    }).join('');
}

async function withTimeout(promise, ms, label) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_resolve, reject) => {
                timer = setTimeout(() => reject(new Error(`timeout ao invocar ${label}`)), ms);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

describe('ferramentas de modelo de linguagem', () => {
    const declared = () => vscode.extensions.getExtension(EXTENSION_ID)
        .packageJSON.contributes.languageModelTools
        .map((tool) => tool.name);

    before(async () => {
        await vscode.extensions.getExtension(EXTENSION_ID).activate();
    });

    it('registra as ferramentas declaradas em contributes.languageModelTools', async () => {
        await check('registro das LM tools', async () => {
            const names = declared();
            assert.deepStrictEqual(names, [
                'netsuite_get_script_context',
                'netsuite_analyze_suitescript',
                'netsuite_get_suiteql_schema',
                'netsuite_get_sdf_context'
            ]);
            assert.ok(vscode.lm && typeof vscode.lm.registerTool === 'function', 'vscode.lm.registerTool indisponível');
            assert.ok(Array.isArray(vscode.lm.tools), 'vscode.lm.tools indisponível');
            const available = new Set(vscode.lm.tools.map((tool) => tool.name));
            const missing = names.filter((name) => !available.has(name));
            assert.deepStrictEqual(
                missing,
                [],
                `não registradas: ${missing.join(', ')}. Ativas: ${[...available].sort().join(', ')}`
            );
            return names.join(', ');
        });
    });

    it('invoca as ferramentas sem chamar o NetSuite', async () => {
        await check('invocação das LM tools', async () => {
            assert.strictEqual(typeof vscode.lm.invokeTool, 'function');
            const summaries = [];
            for (const name of declared()) {
                const result = await withTimeout(vscode.lm.invokeTool(name, {
                    input: {},
                    toolInvocationToken: undefined
                }), 15000, name);
                const text = toolText(result);
                assert.ok(text.length > 0, `${name} devolveu texto vazio`);
                assert.ok(!/netsuite\.com/i.test(text), `${name} devolveu uma URL NetSuite: ${text.slice(0, 300)}`);
                summaries.push(`${name} (${text.length} caracteres)`);
                await sleep(50);
            }
            return summaries.join('; ');
        });
    });
});
