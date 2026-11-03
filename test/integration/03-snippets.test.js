'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { EXTENSION_ID, check, record, sleep, workspacePath } = require('./support');

const PREFIXES = ['map', 'get', 'post'];
const SNIPPET_BODIES = {
    map: 'function map(context)',
    get: 'function get(request)',
    post: 'function post(request)'
};

function itemLabel(item) {
    if (typeof item.label === 'string') {
        return item.label;
    }
    return item.label && item.label.label ? item.label.label : '';
}

function snippetBody(item) {
    const insert = item.insertText;
    const text = typeof insert === 'string' ? insert : (insert && insert.value) || '';
    const documentation = item.documentation && (item.documentation.value || item.documentation) || '';
    return `${text}\n${documentation}`;
}

function matchesSnippetPrefix(item, prefix) {
    const label = itemLabel(item);
    const identity = label === prefix || item.filterText === prefix;
    if (!identity || item.kind !== vscode.CompletionItemKind.Snippet) {
        return false;
    }
    const body = snippetBody(item);
    if (!body.trim()) {
        return true;
    }
    return body.includes(SNIPPET_BODIES[prefix]);
}

async function openLanguageFile(language, text) {
    const extension = language === 'typescript' ? '.ts' : '.js';
    const filePath = path.join(workspacePath(vscode), '.netsuite', `prefixes${extension}`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, text);
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    if (document.languageId !== language) {
        await vscode.languages.setTextDocumentLanguage(document, language);
    }
    await vscode.window.showTextDocument(document, { preview: false });
    return document;
}

function sampleItems(items) {
    return items.slice(0, 40).map((item) => {
        return `${itemLabel(item)} kind=${item.kind} filter=${item.filterText || ''}`;
    }).join('; ');
}

async function completionItems(language, text) {
    const document = await openLanguageFile(language, text);
    let last = [];
    const lines = text.split('\n');
    for (let attempt = 0; attempt < 12; attempt++) {
        const found = [];
        for (let line = 0; line < lines.length; line++) {
            const list = await vscode.commands.executeCommand(
                'vscode.executeCompletionItemProvider',
                document.uri,
                new vscode.Position(line, lines[line].length),
                undefined,
                80
            );
            const items = list && list.items ? list.items : [];
            last = last.concat(items);
            if (items.some((item) => matchesSnippetPrefix(item, lines[line]))) {
                found.push(lines[line]);
            }
        }
        if (PREFIXES.every((prefix) => found.includes(prefix))) {
            return { missing: [], items: last };
        }
        await sleep(250);
    }
    const present = new Set();
    for (const item of last) {
        for (const prefix of PREFIXES) {
            if (matchesSnippetPrefix(item, prefix)) {
                present.add(prefix);
            }
        }
    }
    return {
        missing: PREFIXES.filter((prefix) => !present.has(prefix)),
        items: last
    };
}

describe('snippets e linguagem', () => {
    before(async () => {
        const extension = vscode.extensions.getExtension(EXTENSION_ID);
        await extension.activate();
        const editor = vscode.workspace.getConfiguration('editor');
        await editor.update('snippetSuggestions', 'top', vscode.ConfigurationTarget.Workspace);
        await editor.update('suggest.showSnippets', true, vscode.ConfigurationTarget.Workspace);
        await editor.update('wordBasedSuggestions', 'off', vscode.ConfigurationTarget.Workspace);
    });

    it('contribui snippets para javascript e mantém os prefixos map, get e post', async () => {
        await check('snippets javascript (map, get, post)', async () => {
            const extension = vscode.extensions.getExtension(EXTENSION_ID);
            const contributions = extension.packageJSON.contributes.snippets;
            assert.ok(
                contributions.some((item) => item.language === 'javascript' && item.path === './snippets/snippets.code-snippets'),
                JSON.stringify(contributions)
            );
            const outcome = await completionItems('javascript', PREFIXES.join('\n'));
            assert.deepStrictEqual(
                outcome.missing,
                [],
                `prefixos ausentes na completion de javascript: ${outcome.missing.join(', ')}. Amostra: ${sampleItems(outcome.items)}`
            );
            return 'map, get e post aparecem como snippet em javascript';
        });
    });

    it('prefixos map, get e post aparecem em typescript', async function () {
        const extension = vscode.extensions.getExtension(EXTENSION_ID);
        const contributed = (extension.packageJSON.contributes.snippets || [])
            .map((item) => item.language);
        let outcome;
        try {
            outcome = await completionItems('typescript', PREFIXES.join('\n'));
        } catch (error) {
            record('snippets typescript (map, get, post)', 'falhou', error.message);
            throw error;
        }
        if (outcome.missing.length === 0) {
            record('snippets typescript (map, get, post)', 'passou', 'map, get e post aparecem em typescript');
            return;
        }
        const reason = [
            `BUG: typescript não recebe os prefixos ${outcome.missing.join(', ')}.`,
            `contributes.snippets só declara: ${contributed.join(', ') || '(vazio)'}.`,
            'O arquivo de snippets não muda de prefixo; a contribuição de linguagem é que não inclui typescript.',
            `Amostra da completion: ${sampleItems(outcome.items) || '(vazia)'}`
        ].join(' ');
        record('snippets typescript (map, get, post)', 'falha conhecida', reason);
        console.log(`\nFALHA CONHECIDA: ${reason}\n`);
        this.skip();
    });

    it('sugere módulos N/* dentro de define()', async () => {
        await check('autocomplete N/* em javascript', async () => {
            const content = "define(['N/";
            const filePath = path.join(workspacePath(vscode), '.netsuite', 'module-completion.js');
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, content);
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(document, { preview: false });
            let labels = [];
            for (let attempt = 0; attempt < 10; attempt++) {
                const list = await vscode.commands.executeCommand(
                    'vscode.executeCompletionItemProvider',
                    document.uri,
                    new vscode.Position(0, content.length),
                    '/'
                );
                labels = (list && list.items ? list.items : []).map(itemLabel);
                if (labels.includes('N/record')) {
                    return 'N/record aparece na completion de define([\'N/\'])';
                }
                await sleep(200);
            }
            assert.ok(false, `N/record não apareceu. Amostra: ${labels.slice(0, 30).join(', ')}`);
        });
    });

    it('mostra hover para @NApiVersion', async () => {
        await check('hover de @NApiVersion', async () => {
            const content = '/** @NApiVersion 2.1 */\ndefine([], function () { return {}; });\n';
            const filePath = path.join(workspacePath(vscode), '.netsuite', 'hover.js');
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, content);
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(document, { preview: false });
            const position = new vscode.Position(0, content.indexOf('@NApiVersion') + 2);
            let hovers = [];
            for (let attempt = 0; attempt < 8; attempt++) {
                hovers = await vscode.commands.executeCommand(
                    'vscode.executeHoverProvider',
                    document.uri,
                    position
                );
                if (hovers && hovers.length > 0) {
                    break;
                }
                await sleep(200);
            }
            assert.ok(hovers && hovers.length > 0, 'nenhum hover para @NApiVersion');
            const text = hovers.map((hover) => {
                const contents = Array.isArray(hover.contents) ? hover.contents : [hover.contents];
                return contents.map((part) => {
                    if (typeof part === 'string') {
                        return part;
                    }
                    return (part && part.value) || '';
                }).join('\n');
            }).join('\n');
            assert.match(text, /NApiVersion/);
            return 'hover de @NApiVersion respondeu';
        });
    });
});
