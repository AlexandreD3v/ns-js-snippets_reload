const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { convertTo21, normalizeHeader } = require('../src/migration/convert');
const { auditText } = require('../src/migration/audit');

const fixturesDir = path.join(__dirname, 'fixtures', 'migration');
const sample = fs.readFileSync(path.join(fixturesDir, 'clientscript-20.js'), 'utf8');
const nestedHelper = fs.readFileSync(path.join(fixturesDir, 'nested-helper.js'), 'utf8');

const first = convertTo21(sample);
assert.match(first.output, /@NApiVersion 2\.1/);
assert.match(first.output, /pageInit:\s*\(/);
assert.strictEqual(first.changed, true);

const second = convertTo21(first.output);
assert.strictEqual(second.changed, false, 'conversion should be idempotent');

const nested = convertTo21(nestedHelper);
assert.match(nested.output, /function helper\(\)/, 'nested helper functions must not be converted');
assert.match(nested.output, /beforeLoad:\s*\(/, 'returned entry points should be converted');

const audit = auditText(sample, 'clientscript-20.js');
assert.strictEqual(audit.needsUpgrade, true);
assert.ok(
    !audit.manualReview.some((item) => item.includes('const reassignment')),
    'audit should avoid noisy const warnings'
);

assert.match(normalizeHeader('/** @NApiVersion 2.x */'), /@NApiVersion 2\.1/);
console.log('Migration tests passed.');
