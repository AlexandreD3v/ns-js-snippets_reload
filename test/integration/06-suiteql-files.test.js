'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const {
    EXTENSION_ID,
    check,
    sleep,
    workspacePath
} = require('./support');

async function waitForLanguage(filePath, expected, timeoutMs = 5000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const document = vscode.workspace.textDocuments.find((item) => item.uri.fsPath === filePath);
        if (document && document.languageId === expected) {
            return document;
        }
        await sleep(100);
    }
    const document = vscode.workspace.textDocuments.find((item) => item.uri.fsPath === filePath);
    return document || null;
}

describe('arquivos .sql e SuiteQL', () => {
    const fileName = 'notes.sql';
    let filePath;

    before(async () => {
        await vscode.extensions.getExtension(EXTENSION_ID).activate();
        filePath = path.join(workspacePath(vscode), fileName);
        fs.writeFileSync(filePath, 'SELECT id FROM customer;\n');
        await vscode.workspace.getConfiguration('netsuite').update(
            'suiteqlAssociateSqlFiles',
            false,
            vscode.ConfigurationTarget.Workspace
        );
    });

    after(async () => {
        await vscode.workspace.getConfiguration('netsuite').update(
            'suiteqlAssociateSqlFiles',
            false,
            vscode.ConfigurationTarget.Workspace
        );
        const document = vscode.workspace.textDocuments.find((item) => item.uri.fsPath === filePath);
        if (document && !document.isDirty) {
            await vscode.window.showTextDocument(document, { preview: false, preserveFocus: false });
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
        fs.rmSync(filePath, { force: true });
    });

    it('deixa .sql fora do SuiteQL até a setting', async () => {
        await check('arquivo .sql não é SuiteQL por padrão', async () => {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(document, { preview: false });
            await sleep(200);
            assert.notStrictEqual(document.languageId, 'suiteql');
            const contribution = vscode.extensions.getExtension(EXTENSION_ID).packageJSON.contributes.languages
                .find((language) => language.id === 'suiteql');
            assert.deepStrictEqual(contribution.extensions, ['.suiteql']);
            return document.languageId;
        });
    });

    it('associa .sql quando a setting está ligada e desfaz ao desligar', async () => {
        await check('setting netsuite.suiteqlAssociateSqlFiles', async () => {
            await vscode.workspace.getConfiguration('netsuite').update(
                'suiteqlAssociateSqlFiles',
                true,
                vscode.ConfigurationTarget.Workspace
            );
            const enabled = await waitForLanguage(filePath, 'suiteql');
            assert.ok(enabled, 'o .sql não virou SuiteQL com a setting ligada');

            await vscode.workspace.getConfiguration('netsuite').update(
                'suiteqlAssociateSqlFiles',
                false,
                vscode.ConfigurationTarget.Workspace
            );
            const started = Date.now();
            let languageId = enabled.languageId;
            while (Date.now() - started < 5000) {
                const document = vscode.workspace.textDocuments.find((item) => item.uri.fsPath === filePath);
                languageId = document ? document.languageId : languageId;
                if (languageId !== 'suiteql') {
                    break;
                }
                await sleep(100);
            }
            assert.notStrictEqual(languageId, 'suiteql');
            return languageId;
        });
    });
});
