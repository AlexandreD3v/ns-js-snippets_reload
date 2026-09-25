const assert = require('assert');
const { applyScriptRecordUrlTemplate } = require('../src/commands/suitecloudCommands');

const url = applyScriptRecordUrlTemplate(
    'https://example.app.netsuite.com/app/common/scripting/script.nl?id={scriptId}',
    'customscript_my_script'
);
assert.match(url, /customscript_my_script/);
assert.doesNotMatch(url, /\{scriptId\}/);

const legacy = applyScriptRecordUrlTemplate('https://example.test?id={id}', '123');
assert.match(legacy, /id=123/);

console.log('Hardening tests passed.');
