const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { convertTo21, normalizeHeader } = require('../src/migration/convert');
const { auditText } = require('../src/migration/audit');

const fixturePath = path.join(__dirname, 'fixtures', 'migration', 'clientscript-20.js');
const sample = fs.readFileSync(fixturePath, 'utf8');

const first = convertTo21(sample);
assert.match(first.output, /@NApiVersion 2\.1/);
assert.strictEqual(first.changed, true);

const second = convertTo21(first.output);
assert.strictEqual(second.changed, false, 'conversion should be idempotent');

const audit = auditText(sample, fixturePath);
assert.strictEqual(audit.needsUpgrade, true);

assert.match(normalizeHeader('/** @NApiVersion 2.x */'), /@NApiVersion 2\.1/);
console.log('Migration tests passed.');
