const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { extractSuiteQLBlocks } = require('../src/suiteql/suiteqlAnalyzer');
const { isSqlFileName } = require('../src/suiteql/sqlAssociation');
const {
    classifyAccount,
    readProjectAuth,
    shouldConfirmAccount,
    buildAccountPrompt,
    fileCabinetArgument,
    interpretValidationResult
} = require('../src/services/projectAccount');

function expectKind(authId, kind) {
    assert.strictEqual(classifyAccount(authId).kind, kind, String(authId));
}

function testAccountClassification() {
    for (const authId of ['1234567_SB1', '1234567_SB', '1234567_SB2', 'TSTDRV1234567_SB1', '1234567-sb1', 'acme_SB1', 'my-sandbox', 'sandbox', 'prod_SB1']) {
        expectKind(authId, 'sandbox');
    }
    for (const authId of ['1234567_RP', '123456_RP1', '1234567-rp', 'release-preview']) {
        expectKind(authId, 'release-preview');
    }
    for (const authId of ['1234567', 'TSTDRV1234567', 'prod', 'production', 'acme_prod', 'live']) {
        expectKind(authId, 'production');
    }
    for (const authId of ['dev', 'qa', 'uat', 'staging', 'non-prod', 'nonprod']) {
        expectKind(authId, 'non-production');
    }
    for (const authId of ['acme', 'SB1', 'my_report', '', null]) {
        expectKind(authId, 'unknown');
    }
}

function testConfirmationPolicy() {
    assert.deepStrictEqual(shouldConfirmAccount('production', false), { confirm: true, strong: true });
    assert.deepStrictEqual(shouldConfirmAccount('sandbox', false), { confirm: false, strong: false });
    assert.deepStrictEqual(shouldConfirmAccount('release-preview', false), { confirm: false, strong: false });
    assert.deepStrictEqual(shouldConfirmAccount('non-production', false), { confirm: false, strong: false });
    assert.deepStrictEqual(shouldConfirmAccount('sandbox', true), { confirm: true, strong: false });
    assert.deepStrictEqual(shouldConfirmAccount('unknown', false), { confirm: true, strong: false });

    const sandbox = buildAccountPrompt({
        action: 'deploy',
        auth: { status: 'ok', authId: '1234567_SB1', environment: classifyAccount('1234567_SB1') },
        alwaysConfirm: true
    });
    assert.strictEqual(sandbox.confirmLabel, 'Deploy');
    assert.match(sandbox.message, /1234567_SB1" \(sandbox\)/);
    assert.strictEqual(sandbox.strong, false);

    const skipped = buildAccountPrompt({
        action: 'upload',
        auth: { status: 'ok', authId: '1234567_SB1', environment: classifyAccount('1234567_SB1') },
        alwaysConfirm: false
    });
    assert.strictEqual(skipped, null);

    const production = buildAccountPrompt({
        action: 'upload',
        auth: { status: 'ok', authId: 'acme_prod', environment: classifyAccount('acme_prod') },
        alwaysConfirm: false
    });
    assert.strictEqual(production.confirmLabel, 'Upload to production');
    assert.match(production.message, /PRODUCTION account "acme_prod"/);
    assert.strictEqual(production.strong, true);

    const missing = buildAccountPrompt({
        action: 'deploy',
        auth: { status: 'missing', authId: null, environment: classifyAccount(null) },
        alwaysConfirm: false
    });
    assert.match(missing.message, /no SuiteCloud auth ID/);
    assert.strictEqual(missing.confirmLabel, 'Deploy');
}

function testProjectJson() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-auth-'));
    assert.strictEqual(readProjectAuth(root).status, 'missing');

    const filePath = path.join(root, 'project.json');
    fs.writeFileSync(filePath, '{"defaultAuthId":"1234567_SB1","other":true}\n');
    const sandbox = readProjectAuth(root);
    assert.strictEqual(sandbox.status, 'ok');
    assert.strictEqual(sandbox.authId, '1234567_SB1');
    assert.strictEqual(sandbox.environment.kind, 'sandbox');

    fs.writeFileSync(filePath, '{');
    assert.strictEqual(readProjectAuth(root).status, 'invalid');

    fs.writeFileSync(filePath, '{"defaultAuthId":"  "}\n');
    assert.strictEqual(readProjectAuth(root).status, 'empty');
    fs.rmSync(root, { recursive: true, force: true });
}

function testValidationAndPaths() {
    assert.strictEqual(interpretValidationResult({ exitCode: 0 }), 'continue');
    assert.strictEqual(interpretValidationResult({ exitCode: 1 }), 'ask');
    assert.strictEqual(interpretValidationResult({ exitCode: -1, cliMissing: true }), 'stop');
    assert.strictEqual(interpretValidationResult({ exitCode: -1 }), 'stop');
    assert.strictEqual(interpretValidationResult({ exitCode: 2, cancelled: true }), 'stop');
    assert.strictEqual(interpretValidationResult(null), 'stop');

    assert.strictEqual(fileCabinetArgument('SuiteScripts/hello.js'), '/SuiteScripts/hello.js');
    assert.strictEqual(fileCabinetArgument('/SuiteScripts/hello.js'), '/SuiteScripts/hello.js');
    assert.strictEqual(fileCabinetArgument('SuiteScripts\\hello.js'), '/SuiteScripts/hello.js');
    assert.strictEqual(fileCabinetArgument('../secret.js'), null);
    assert.strictEqual(fileCabinetArgument(''), null);
}

function testSuiteQLExtraction() {
    const legacy = 'query.runSuiteQL({ query: `SELECT id FROM customer` })';
    assert.deepStrictEqual(extractSuiteQLBlocks(legacy), ['SELECT id FROM customer']);

    const named = 'const query = `SELECT id FROM vendor`;\nconst other = 1;';
    assert.deepStrictEqual(extractSuiteQLBlocks(named), ['SELECT id FROM vendor']);

    const legacyWithoutSelect = 'query.runSuiteQL({ query: `id FROM customer` })';
    assert.deepStrictEqual(extractSuiteQLBlocks(legacyWithoutSelect), ['id FROM customer']);

    const both = [
        'const extra = `SELECT id FROM employee`;',
        'query.runSuiteQL({ query: `not a query` });'
    ].join('\n');
    assert.deepStrictEqual(extractSuiteQLBlocks(both), ['SELECT id FROM employee']);

    const selected = extractSuiteQLBlocks(both, { selection: 'SELECT id FROM transaction' });
    assert.deepStrictEqual(selected, ['SELECT id FROM transaction']);

    const wrapped = extractSuiteQLBlocks('ignored', { selection: '`SELECT id FROM partner`' });
    assert.deepStrictEqual(wrapped, ['SELECT id FROM partner']);

    const two = 'const a = `SELECT 1 FROM customer`;\nconst b = `SELECT 2 FROM vendor`;';
    const insideSecond = two.indexOf('SELECT 2');
    assert.deepStrictEqual(extractSuiteQLBlocks(two, { offset: insideSecond }), ['SELECT 2 FROM vendor']);
    assert.deepStrictEqual(extractSuiteQLBlocks('const value = 1;'), []);
}

function testSqlAssociationManifest() {
    assert.strictEqual(isSqlFileName('notes.sql'), true);
    assert.strictEqual(isSqlFileName('notes.SQL'), true);
    assert.strictEqual(isSqlFileName('query.suiteql'), false);
    assert.strictEqual(isSqlFileName('notes.sql.txt'), false);

    const pkg = require('../package.json');
    const suiteql = pkg.contributes.languages.find((language) => language.id === 'suiteql');
    assert.deepStrictEqual(suiteql.extensions, ['.suiteql']);
    assert.strictEqual(pkg.contributes.configuration.properties['netsuite.suiteqlAssociateSqlFiles'].default, false);
    assert.strictEqual(pkg.contributes.configuration.properties['netsuite.suitecloudAlwaysConfirmAccount'].default, true);
    assert.strictEqual(pkg.version, '0.7.0');
}

testAccountClassification();
testConfirmationPolicy();
testProjectJson();
testValidationAndPaths();
testSuiteQLExtraction();
testSqlAssociationManifest();
console.log('Deploy safety tests passed.');
