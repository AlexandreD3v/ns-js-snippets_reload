const assert = require('assert');
const { buildCommandLine, quoteArg } = require('../src/utils/processRunner');
const { isInside, findUp } = require('../src/utils/workspace');
const path = require('path');
const fs = require('fs');
const os = require('os');

function testQuoteArg() {
    assert.match(buildCommandLine('suitecloud', ['project:validate']), /suitecloud/);
    assert.match(quoteArg('hello world', 'win32'), /"/);
}

function testWorkspaceHelpers() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-workspace-'));
    const child = path.join(root, 'src', 'file.js');
    fs.mkdirSync(path.dirname(child), { recursive: true });
    fs.writeFileSync(child, 'test');
    assert.strictEqual(isInside(root, child), true);
    fs.writeFileSync(path.join(root, 'suitecloud.config.js'), '{}');
    assert.strictEqual(findUp(child, ['suitecloud.config.js'], root), root);
    fs.rmSync(root, { recursive: true, force: true });
}

testQuoteArg();
testWorkspaceHelpers();
console.log('Foundation tests passed.');
