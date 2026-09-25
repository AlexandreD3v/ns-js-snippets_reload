const assert = require('assert');
const { loadCustomFields, normalizeCustomFields, shouldSuggestFieldId, getFieldSuggestions } = require('../src/utils/customFields');
const { buildScriptContent } = require('../src/utils/scriptTemplates');
const entryPoints = require('../data/entryPoints.json');

function testCustomFields() {
    const normalized = normalizeCustomFields({
        fields: ['custbody_global'],
        customFields: {
            customer: ['custentity_flag']
        }
    });

    assert.deepStrictEqual(normalized.allFields.sort(), ['custbody_global', 'custentity_flag'].sort());
    assert.strictEqual(normalized.byRecordType.customer.length, 1);
    assert.strictEqual(shouldSuggestFieldId("fieldId: 'cust"), true);
    assert.strictEqual(shouldSuggestFieldId('record.load({'), false);

    const suggestions = getFieldSuggestions(
        "fieldId: 'cust",
        "record.load({ type: record.Type.CUSTOMER, id: 1 }); fieldId: 'cust",
        normalized
    );
    assert.ok(suggestions.includes('custentity_flag'));
}

function testScriptTemplates() {
    const content = buildScriptContent('scheduledscript', entryPoints, {
        apiVersion: '2.1',
        moduleScope: 'SameAccount'
    });

    assert.match(content, /@NScriptType ScheduledScript/);
    assert.match(content, /execute: \(context\) =>/);
}

function testLoadCustomFieldsWithoutWorkspace() {
    const vscode = { workspace: { workspaceFolders: undefined, getConfiguration: () => ({ get: () => '.vscode/netsuite-fields.json' }) } };
    const result = loadCustomFields(vscode);
    assert.deepStrictEqual(result.allFields, []);
}

testCustomFields();
testScriptTemplates();
testLoadCustomFieldsWithoutWorkspace();
console.log('Tier 2 tests passed.');
