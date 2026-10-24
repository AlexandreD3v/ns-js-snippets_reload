const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { convertTo21, normalizeHeader, isSuiteScriptFile } = require('../src/migration/convert');
const { auditText } = require('../src/migration/audit');

const fixturePath = path.join(__dirname, 'fixtures', 'migration', 'clientscript-20.js');
const sample = fs.readFileSync(fixturePath, 'utf8');

const first = convertTo21(sample);
assert.match(first.output, /@NApiVersion 2\.1/);
assert.match(first.output, /pageInit: \(context\) => \{/);
assert.match(first.output, /define\(\[\], function \(\)/);
assert.doesNotMatch(first.output, /pageInit: function/);
assert.strictEqual(first.changed, true);

const second = convertTo21(first.output);
assert.strictEqual(second.changed, false, 'conversion should be idempotent');
assert.strictEqual(second.output, first.output);

const config = "module.exports = {\n    defaultProjectFolder: 'src',\n    commands: {}\n};\n";
const configResult = convertTo21(config);
assert.strictEqual(configResult.changed, false);
assert.strictEqual(configResult.output, config);
assert.strictEqual(isSuiteScriptFile('suitecloud.config.js', config), false);

const compact = [
    '/**',
    ' * @NApiVersion 2.0',
    ' */',
    'define(["N/log"], function (log) {',
    '    return {pageInit:function(context){log.debug("a",1);}};',
    '});',
    ''
].join('\n');
const compactResult = convertTo21(compact);
assert.match(compactResult.output, /define\(\["N\/log"\], function \(log\)/);
assert.match(compactResult.output, /pageInit:\(context\) => \{log\.debug\("a",1\);\}/);

const usesThis = [
    '/** @NApiVersion 2.1 */',
    'define([], function () {',
    '    return { onRequest: function (ctx) { this.ok = true; } };',
    '});',
    ''
].join('\n');
const thisResult = convertTo21(usesThis);
assert.strictEqual(thisResult.changed, false);
assert.strictEqual(thisResult.output, usesThis);
assert.ok(thisResult.audit.manualReview.some((note) => /this or arguments/.test(note)));

const audit = auditText(sample, fixturePath);
assert.strictEqual(audit.needsUpgrade, true);

assert.match(normalizeHeader('/** @NApiVersion 2.x */'), /@NApiVersion 2\.1/);
console.log('Migration tests passed.');
