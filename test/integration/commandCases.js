'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SAMPLE_SCRIPT = [
    '/**',
    ' * @NApiVersion 2.1',
    ' * @NScriptType UserEventScript',
    ' */',
    'define(["N/record"], (record) => {',
    '    return {',
    '        beforeLoad: (context) => context',
    '    };',
    '});',
    ''
].join('\n');

const LEGACY_SCRIPT = [
    '/**',
    ' * @NApiVersion 2.0',
    ' * @NScriptType UserEventScript',
    ' */',
    'define([], function () {',
    '    return {',
    '        beforeLoad: function beforeLoad(context) {',
    '            return context;',
    '        }',
    '    };',
    '});',
    ''
].join('\n');

function workspacePath(vscode) {
    const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
    if (!folder) {
        throw new Error('O VS Code de teste não abriu a pasta de trabalho.');
    }
    return folder.uri.fsPath;
}

let scratchCounter = 0;

async function openDocument(vscode, options) {
    const extensionByLanguage = {
        javascript: '.js',
        typescript: '.ts',
        suiteql: '.suiteql',
        markdown: '.md'
    };
    const extension = extensionByLanguage[options.language] || '.txt';
    scratchCounter += 1;
    const opened = await openWorkspaceFile(
        vscode,
        path.join('.netsuite', `scratch-${scratchCounter}${extension}`),
        options.content || ''
    );
    if (options.language && opened.document.languageId !== options.language) {
        await vscode.languages.setTextDocumentLanguage(opened.document, options.language);
    }
    return opened;
}

async function openWorkspaceFile(vscode, fileName, content) {
    const filePath = path.join(workspacePath(vscode), fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    return { document, editor, filePath };
}

function messages(harness) {
    return harness.calls.map((call) => call.text).join('\n');
}

const noEditorCases = [
    {
        id: 'netsuite.newScript',
        scenario: 'seleção de tipo cancelada',
        feedback: /Select a SuiteScript type/
    },
    {
        id: 'netsuite.insertScriptParameters',
        scenario: 'sem arquivo JavaScript',
        feedback: /Open a JavaScript file to insert script parameters/
    },
    {
        id: 'netsuite.wrapSelectionInDefine',
        scenario: 'sem arquivo JavaScript',
        feedback: /Open a JavaScript file to wrap code in define\(\)/
    },
    {
        id: 'netsuite.validateFile',
        scenario: 'sem arquivo aberto',
        feedback: /Open a SuiteScript or SuiteQL file to validate/
    },
    {
        id: 'netsuite.reloadCustomFields',
        scenario: 'pasta sem netsuite-fields.json',
        feedback: /Loaded \d+ custom field IDs across \d+ workspace folder/
    },
    {
        id: 'netsuite.convertCurrentScript21',
        scenario: 'sem arquivo JavaScript',
        feedback: /Open a JavaScript SuiteScript file to convert/
    },
    {
        id: 'netsuite.convertWorkspace21',
        scenario: 'pasta sem SuiteScript conversível',
        feedback: /No convertible SuiteScript files found/
    },
    {
        id: 'netsuite.createSuiteQLQuery',
        scenario: 'nome do arquivo cancelado',
        feedback: /SuiteQL file name/
    },
    {
        id: 'netsuite.extractSuiteQLToFile',
        scenario: 'sem arquivo aberto',
        feedback: /Open a JavaScript file with an embedded SuiteQL query/
    },
    {
        id: 'netsuite.insertSuiteQLAsNQuery',
        scenario: 'sem arquivo aberto',
        feedback: /Open a SuiteQL file or select a query in a JavaScript file/
    },
    {
        id: 'netsuite.suitecloudValidate',
        scenario: 'sem projeto SuiteCloud',
        feedback: /No SuiteCloud project detected/
    },
    {
        id: 'netsuite.suitecloudDeploy',
        scenario: 'sem projeto SuiteCloud',
        feedback: /No SuiteCloud project detected/
    },
    {
        id: 'netsuite.suitecloudUpload',
        scenario: 'sem arquivo no File Cabinet',
        feedback: /Open a file inside the project FileCabinet folder/
    },
    {
        id: 'netsuite.suitecloudCreateProject',
        scenario: 'CLI ausente',
        feedback: /SuiteCloud CLI was not found/,
        assertMissingCli: true
    },
    {
        id: 'netsuite.suitecloudAccountSetup',
        scenario: 'sem projeto SuiteCloud',
        feedback: /No SuiteCloud project detected/
    },
    {
        id: 'netsuite.suitecloudImportObject',
        scenario: 'sem projeto SuiteCloud',
        feedback: /No SuiteCloud project detected/
    },
    {
        id: 'netsuite.suitecloudImportFile',
        scenario: 'sem projeto SuiteCloud',
        feedback: /No SuiteCloud project detected/
    },
    {
        id: 'netsuite.suitecloudOpenRelatedObject',
        scenario: 'sem script num projeto',
        feedback: /Open a script inside a SuiteCloud project/
    },
    {
        id: 'netsuite.copyScriptForUpload',
        scenario: 'sem arquivo aberto',
        feedback: /Open a script to copy for manual upload/
    },
    {
        id: 'netsuite.openScriptRecordUrl',
        scenario: 'sem netsuite.scriptRecordUrlTemplate',
        feedback: /Set netsuite\.scriptRecordUrlTemplate/
    },
    {
        id: 'netsuite.copyAiContext',
        scenario: 'sem arquivo aberto',
        feedback: /Open a SuiteScript or SuiteQL file first/
    },
    {
        id: 'netsuite.configureDeveloperAssistant',
        scenario: 'CLI ausente',
        feedback: /SuiteCloud CLI was not found/,
        assertMissingCli: true
    },
    {
        id: 'netsuite.addModuleImport',
        scenario: 'sem arquivo JavaScript',
        feedback: /Open a JavaScript SuiteScript file/
    },
    {
        id: 'netsuite.goToFieldDefinition',
        scenario: 'sem arquivo aberto',
        feedback: /Open a file and place the cursor on a cust\* field id/
    },
    {
        id: 'netsuite.scaffoldJestTest',
        scenario: 'sem arquivo JavaScript',
        feedback: /Open a JavaScript SuiteScript file to scaffold a Jest test/
    },
    {
        id: 'netsuite.debugShowRatingPrompt',
        scenario: 'pré-visualização sem gravar resposta',
        feedback: /Enjoying NetSuite JS Snippets Reload/
    }
];

const followUpCases = [
    {
        id: 'netsuite.auditWorkspace21',
        scenario: 'pasta sem arquivos SuiteScript',
        feedback: /Audit complete:/
    },
    {
        id: 'netsuite.openScriptRecordUrl',
        scenario: 'URL local interceptada, sem abrir o navegador',
        allowExternal: true,
        feedback: /Opened the script record URL/,
        async setup(harness, vscode) {
            await vscode.workspace.getConfiguration('netsuite').update(
                'scriptRecordUrlTemplate',
                'https://example.invalid/script?id={scriptId}',
                vscode.ConfigurationTarget.Workspace
            );
            harness.setInput('abc 1');
        },
        async assert(_vscode, harness) {
            assert.strictEqual(harness.opened.length, 1);
            assert.match(harness.opened[0], /^https:\/\/example\.invalid\/script\?id=abc(?:%20| )1$/);
            assert.doesNotMatch(harness.opened[0], /netsuite\.com/i);
        },
        async cleanup(vscode) {
            await vscode.workspace.getConfiguration('netsuite').update(
                'scriptRecordUrlTemplate',
                '',
                vscode.ConfigurationTarget.Workspace
            );
        }
    },
    {
        id: 'netsuite.validateFile',
        scenario: 'JavaScript sem anotações SuiteScript',
        feedback: /Found \d+ SuiteScript issue/,
        async setup(_harness, vscode) {
            await openDocument(vscode, {
                language: 'javascript',
                content: 'define([], function () {\n    return 1;\n});\n'
            });
        },
        async assert(vscode) {
            const editor = vscode.window.activeTextEditor;
            assert.ok(editor, 'o arquivo de validação deveria continuar aberto');
            const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
            assert.ok(
                diagnostics.some((item) => /@NApiVersion|@NScriptType|return/.test(item.message)),
                `diagnósticos inesperados: ${diagnostics.map((item) => item.message).join('; ')}`
            );
        }
    },
    {
        id: 'netsuite.insertScriptParameters',
        scenario: 'insere o bloco no JavaScript ativo',
        async setup(_harness, vscode) {
            await openDocument(vscode, { language: 'javascript', content: '' });
        },
        async assert(vscode) {
            const text = vscode.window.activeTextEditor.document.getText();
            assert.match(text, /Script Parameter/);
            assert.match(text, /custscript_my_param/);
        }
    },
    {
        id: 'netsuite.wrapSelectionInDefine',
        scenario: 'envolve a seleção em define()',
        feedback: /Wrapped the selection in define\(\)/,
        async setup(_harness, vscode) {
            const content = 'var x = 1;';
            const { editor } = await openDocument(vscode, { language: 'javascript', content });
            editor.selection = new vscode.Selection(0, 0, 0, content.length);
        },
        async assert(vscode) {
            const text = vscode.window.activeTextEditor.document.getText();
            assert.match(text, /define\(\[\]/);
            assert.match(text, /@NApiVersion/);
            assert.match(text, /var x = 1;/);
        }
    },
    {
        id: 'netsuite.addModuleImport',
        scenario: 'adiciona N/log num define() local',
        feedback: /Imported N\/log as log/,
        async setup(harness, vscode) {
            harness.setQuickPick('N/log');
            await openDocument(vscode, { language: 'javascript', content: SAMPLE_SCRIPT });
        },
        async assert(vscode) {
            const text = vscode.window.activeTextEditor.document.getText();
            assert.match(text, /N\/log/);
            assert.match(text, /record,\s*log/);
        }
    },
    {
        id: 'netsuite.goToFieldDefinition',
        scenario: 'campo cust* sem definição local',
        feedback: /No local SDF or schema definition found for custbody_missing/,
        async setup(_harness, vscode) {
            const content = "const id = 'custbody_missing';\n";
            const { document, editor } = await openDocument(vscode, { language: 'javascript', content });
            const position = document.positionAt(content.indexOf('custbody_missing') + 2);
            editor.selection = new vscode.Selection(position, position);
        }
    },
    {
        id: 'netsuite.extractSuiteQLToFile',
        scenario: 'JavaScript sem template SuiteQL',
        feedback: /No SuiteQL query found/,
        async setup(_harness, vscode) {
            await openDocument(vscode, { language: 'javascript', content: SAMPLE_SCRIPT });
        }
    },
    {
        id: 'netsuite.extractSuiteQLToFile',
        scenario: 'template literal com SELECT, sem query:',
        feedback: /Extracted SuiteQL to from-template\.suiteql/,
        async setup(harness, vscode) {
            harness.setInput('from-template.suiteql');
            await openDocument(vscode, {
                language: 'javascript',
                content: [
                    'define([], () => {',
                    '    const query = `SELECT id FROM vendor`;',
                    '    return query;',
                    '});',
                    ''
                ].join('\n')
            });
        },
        async assert(vscode) {
            const filePath = path.join(workspacePath(vscode), 'from-template.suiteql');
            assert.ok(fs.existsSync(filePath), filePath);
            assert.strictEqual(fs.readFileSync(filePath, 'utf8').trim(), 'SELECT id FROM vendor');
        }
    },
    {
        id: 'netsuite.extractSuiteQLToFile',
        scenario: 'usa a seleção do editor',
        feedback: /Extracted SuiteQL to from-selection\.suiteql/,
        async setup(harness, vscode) {
            harness.setInput('from-selection.suiteql');
            const content = 'const ignored = `SELECT id FROM customer`;\nconst picked = "SELECT id FROM employee";\n';
            const { document, editor } = await openDocument(vscode, { language: 'javascript', content });
            const start = document.positionAt(content.indexOf('SELECT id FROM employee'));
            const end = document.positionAt(content.indexOf('SELECT id FROM employee') + 'SELECT id FROM employee'.length);
            editor.selection = new vscode.Selection(start, end);
        },
        async assert(vscode) {
            const filePath = path.join(workspacePath(vscode), 'from-selection.suiteql');
            assert.strictEqual(fs.readFileSync(filePath, 'utf8').trim(), 'SELECT id FROM employee');
        }
    },
    {
        id: 'netsuite.scaffoldJestTest',
        scenario: 'gera o teste ao lado do script salvo',
        feedback: /Jest test scaffold written to __tests__\/suite_sample\.test\.js/,
        async setup(_harness, vscode) {
            await openWorkspaceFile(vscode, 'suite_sample.js', SAMPLE_SCRIPT);
        },
        async assert(vscode) {
            const testPath = path.join(workspacePath(vscode), '__tests__', 'suite_sample.test.js');
            assert.ok(fs.existsSync(testPath), testPath);
            assert.match(fs.readFileSync(testPath, 'utf8'), /require\('\.\.\/suite_sample'\)/);
        }
    },
    {
        id: 'netsuite.copyScriptForUpload',
        scenario: 'copia o script ativo para a área de transferência',
        feedback: /Active script copied to clipboard for Script Editor upload/,
        async setup(_harness, vscode) {
            await openWorkspaceFile(vscode, 'copy_sample.js', SAMPLE_SCRIPT);
        },
        async assert(vscode) {
            const copied = await vscode.env.clipboard.readText();
            assert.match(copied, /@NScriptType UserEventScript/);
        }
    },
    {
        id: 'netsuite.copyAiContext',
        scenario: 'copia contexto sanitizado, sem rede',
        feedback: /NetSuite AI context copied to clipboard/,
        async setup(harness, vscode) {
            harness.setQuickPick((items) => items[0]);
            await openWorkspaceFile(vscode, 'ai_sample.js', SAMPLE_SCRIPT);
        },
        async assert(vscode) {
            const copied = await vscode.env.clipboard.readText();
            const payload = JSON.parse(copied);
            assert.ok(payload);
            assert.ok(!/netsuite\.com/i.test(copied));
        }
    },
    {
        id: 'netsuite.convertCurrentScript21',
        scenario: 'prévia 2.0 cancelada, arquivo intacto',
        feedback: /Apply SuiteScript 2\.1 conversion to the current file\?/,
        async setup(harness, vscode) {
            harness.setMessage('Cancel');
            await openWorkspaceFile(vscode, 'legacy_20.js', LEGACY_SCRIPT);
        },
        async assert(vscode) {
            assert.match(vscode.window.activeTextEditor.document.getText(), /@NApiVersion 2\.0/);
        }
    },
    {
        id: 'netsuite.insertSuiteQLAsNQuery',
        scenario: 'insere N/query a partir de um .suiteql',
        feedback: /Inserted N\/query block/,
        async setup(_harness, vscode) {
            await openDocument(vscode, {
                language: 'suiteql',
                content: 'SELECT id\nFROM customer\n'
            });
        },
        async assert(vscode) {
            const texts = vscode.workspace.textDocuments.map((document) => document.getText());
            assert.ok(texts.some((text) => text.includes('query.runSuiteQL')), texts.join('\n---\n'));
        }
    },
    {
        id: 'netsuite.newScript',
        scenario: 'gera User Event local, sem deploy',
        async setup(harness) {
            harness.setQuickPick('User Event Script');
            harness.setInput('generated-user-event.js');
        },
        async assert(vscode) {
            const filePath = path.join(workspacePath(vscode), 'generated-user-event.js');
            assert.ok(fs.existsSync(filePath), filePath);
            const text = fs.readFileSync(filePath, 'utf8');
            assert.match(text, /@NApiVersion 2\.1/);
            assert.match(text, /@NScriptType UserEventScript/);
            assert.doesNotMatch(text, /netsuite\.com/i);
        }
    },
    {
        id: 'netsuite.createSuiteQLQuery',
        scenario: 'cria query.suiteql na pasta local',
        feedback: /Created query\.suiteql/,
        async setup(harness) {
            harness.setInput('query.suiteql');
        },
        async assert(vscode) {
            const filePath = path.join(workspacePath(vscode), 'query.suiteql');
            assert.ok(fs.existsSync(filePath), filePath);
            assert.match(fs.readFileSync(filePath, 'utf8'), /FROM\s+customer/);
        }
    },
    {
        id: 'netsuite.createCustomFieldsConfig',
        scenario: 'cria o exemplo netsuite-fields.json',
        async setup(_harness, vscode) {
            await openDocument(vscode, { language: 'javascript', content: '' });
        },
        async assert(vscode) {
            const filePath = path.join(workspacePath(vscode), '.vscode', 'netsuite-fields.json');
            assert.ok(fs.existsSync(filePath), filePath);
            assert.match(fs.readFileSync(filePath, 'utf8'), /custbody_example_field/);
            assert.ok(
                vscode.window.activeTextEditor
                && vscode.window.activeTextEditor.document.uri.fsPath === filePath,
                'o exemplo de campos deveria ser o editor ativo'
            );
        }
    },
    {
        id: 'netsuite.createSuiteQLSchema',
        scenario: 'cria o exemplo de schema SuiteQL',
        feedback: /Created the SuiteQL schema example/,
        async assert(vscode) {
            const filePath = path.join(workspacePath(vscode), '.vscode', 'netsuite-suiteql-schema.json');
            assert.ok(fs.existsSync(filePath), filePath);
        }
    }
];

function assertCaseResult(spec, vscode, harness) {
    if (spec.feedback) {
        const matched = harness.calls.some((call) => spec.feedback.test(call.text));
        assert.ok(matched, `sem o feedback ${spec.feedback}. Mensagens: ${messages(harness)}`);
    }
    if (spec.assertMissingCli) {
        const text = messages(harness);
        assert.ok(
            text.includes(process.env.NS_MISSING_SUITECLOUD),
            `a mensagem não cita o CLI ausente configurado. Mensagens: ${text}`
        );
        assert.ok(!/"suitecloud"/.test(text), `o comando caiu no executável suitecloud do PATH. Mensagens: ${text}`);
    }
}

module.exports = {
    noEditorCases,
    followUpCases,
    assertCaseResult,
    messages
};
