'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { defineConfig } = require('@vscode/test-cli');

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-js-snippets-it-'));
const missingCli = path.join(workspace, 'missing-suitecloud');
const fakeCli = path.join(__dirname, 'test', 'integration', 'fixtures', 'fake-suitecloud.js');

fs.mkdirSync(path.join(workspace, '.vscode'), { recursive: true });
fs.writeFileSync(path.join(workspace, '.vscode', 'settings.json'), JSON.stringify({
    'netsuite.suitecloudPath': missingCli,
    'netsuite.scriptRecordUrlTemplate': '',
    'netsuite.suitecloudValidateBeforeDeploy': true,
    'editor.snippetSuggestions': 'top',
    'editor.suggest.showSnippets': true,
    'editor.wordBasedSuggestions': 'off',
    'editor.quickSuggestions': {
        other: true,
        comments: true,
        strings: true
    },
    'telemetry.telemetryLevel': 'off',
    'update.mode': 'none'
}, null, 2));

module.exports = defineConfig({
    files: [
        'test/integration/01-activation.test.js',
        'test/integration/02-commands.test.js',
        'test/integration/03-snippets.test.js',
        'test/integration/04-lm-tools.test.js',
        'test/integration/05-suitecloud-mock.test.js'
    ],
    version: 'stable',
    extensionDevelopmentPath: __dirname,
    workspaceFolder: workspace,
    mocha: {
        ui: 'bdd',
        timeout: 60000
    },
    launchArgs: [
        '--disable-extensions',
        '--disable-workspace-trust',
        '--skip-welcome',
        '--skip-release-notes'
    ],
    env: {
        NS_TEST_WORKSPACE: workspace,
        NS_MISSING_SUITECLOUD: missingCli,
        NS_FAKE_SUITECLOUD_LOG: path.join(workspace, 'fake-suitecloud.log'),
        NS_FAKE_SUITECLOUD_BIN: fakeCli,
        NS_INTEGRATION_REPORT: path.join(__dirname, 'test-results', 'integration-report.json')
    }
});
