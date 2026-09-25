const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildFileContext, buildWorkspaceSummary } = require('../mcp/workspaceContext');

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-mcp-'));
const scriptPath = path.join(workspace, 'FileCabinet', 'Scripts', 'cs.js');
fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
fs.writeFileSync(scriptPath, [
    '/**',
    ' * @NApiVersion 2.1',
    ' * @NScriptType ClientScript',
    ' */',
    "define(['N/log'], function (log) {",
    '    return {',
    '        pageInit: function () {',
    '            log.debug({ title: "hi", details: "there" });',
    '        }',
    '    };',
    '});',
    ''
].join('\n'));

process.env.NS_MCP_WORKSPACE = workspace;
const context = buildFileContext(workspace, 'FileCabinet/Scripts/cs.js');
assert.strictEqual(context.scriptType, 'clientscript');
assert.ok(context.diagnostics.length >= 0);

const summary = buildWorkspaceSummary(workspace);
assert.strictEqual(summary.workspaceRoot, workspace);

delete process.env.NS_MCP_WORKSPACE;
fs.rmSync(workspace, { recursive: true, force: true });
console.log('MCP context tests passed.');
