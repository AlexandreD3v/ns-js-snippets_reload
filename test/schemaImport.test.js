const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { importSchemaFile, parseCsvSchema } = require('../src/suiteql/schemaImport');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-schema-'));
const source = path.join(dir, 'source.json');
const target = path.join(dir, 'target.json');

fs.writeFileSync(source, JSON.stringify({
    columns: {
        customer: ['id', 'entityid', 'custentity_flag']
    }
}, null, 2));

const first = importSchemaFile(source, target);
assert.strictEqual(first.tableCount, 1);
assert.ok(first.columnCount >= 3);

fs.writeFileSync(source, JSON.stringify({
    columns: {
        customer: ['email'],
        item: ['id', 'itemid']
    }
}, null, 2));

const second = importSchemaFile(source, target);
const merged = JSON.parse(fs.readFileSync(target, 'utf8'));
assert.ok(merged.columns.customer.includes('email'));
assert.ok(merged.columns.item.includes('itemid'));

const csv = parseCsvSchema('customer,entityid\nitem,itemid\n');
assert.deepStrictEqual(csv.columns.customer, ['entityid']);
assert.deepStrictEqual(csv.columns.item, ['itemid']);

fs.rmSync(dir, { recursive: true, force: true });
console.log('Schema import tests passed.');
