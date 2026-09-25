const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    detectImportedModules,
    getExportedEntryPoints
} = require('../src/utils/parseSuiteScript');

const arrowDefine = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'migration', 'arrow-define.js'),
    'utf8'
);

assert.deepStrictEqual(detectImportedModules(arrowDefine), []);
assert.deepStrictEqual([...getExportedEntryPoints(arrowDefine)], ['pageInit']);

const amdSample = [
    "define(['N/record', 'N/log'], function (record, log) {",
    '    return {',
    '        beforeSubmit: function (context) {',
    '            log.debug({ title: "x", details: record });',
    '        }',
    '    };',
    '});'
].join('\n');

const imports = detectImportedModules(amdSample);
assert.strictEqual(imports.length, 2);
assert.strictEqual(imports[0].path, 'N/record');
assert.strictEqual(imports[1].alias, 'log');
assert.ok(getExportedEntryPoints(amdSample).has('beforeSubmit'));

console.log('parseSuiteScript tests passed.');
