const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createToolCatalog, buildMcpLaunch, PROVIDER_ID, SERVER_NAME } = require('../src/mcp/tools');
const { createProtocolHandler, extractFrames } = require('../src/mcp/protocol');

const extensionPath = path.join(__dirname, '..');
const catalog = createToolCatalog(extensionPath);
const handle = createProtocolHandler({
    catalog,
    serverInfo: { name: SERVER_NAME, version: '0.7.0' }
});

function testProtocol() {
    const init = handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '0' }
        }
    });
    assert.strictEqual(init.length, 1);
    assert.strictEqual(init[0].result.protocolVersion, '2024-11-05');
    assert.strictEqual(init[0].result.serverInfo.name, SERVER_NAME);
    assert.ok(init[0].result.capabilities.tools);
    assert.strictEqual(handle({ jsonrpc: '2.0', method: 'notifications/initialized' }).length, 0);

    const listed = handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = listed[0].result.tools;
    assert.ok(tools.length >= 6);
    const names = tools.map((tool) => tool.name);
    assert.strictEqual(new Set(names).size, names.length);
    for (const tool of tools) {
        assert.strictEqual(tool.inputSchema.type, 'object');
        assert.strictEqual(typeof tool.description, 'string');
        assert.ok(tool.description.length > 20);
    }
    const lookup = tools.find((tool) => tool.name === 'netsuite_lookup_api');
    assert.deepStrictEqual(lookup.inputSchema.required, ['query']);

    const record = textResult(handle(call(3, 'netsuite_lookup_api', { query: 'N/record' })));
    assert.match(record, /Create, load, update and delete NetSuite records/);
    assert.doesNotMatch(record, /Copy AI Context/);

    const snippets = textResult(handle(call(4, 'netsuite_search_snippets', { query: 'ClientScript', limit: 3 })));
    assert.match(snippets, /"prefix": "ClientScript"/);

    const suiteql = textResult(handle(call(5, 'netsuite_get_suiteql_schema', { table: 'customer' })));
    assert.match(suiteql, /Customer records/);

    const missingTable = handle(call(6, 'netsuite_get_suiteql_schema', { table: 'not_a_real_table' }));
    assert.strictEqual(missingTable[0].result.isError, true);

    const converted = JSON.parse(textResult(handle(call(7, 'netsuite_convert_script', {
        source: '/**\n * @NApiVersion 2.0\n */\ndefine([], function () {\n  return { pageInit: function (context) { return true; } };\n});\n'
    }))));
    assert.strictEqual(converted.changed, true);
    assert.match(converted.output, /@NApiVersion 2\.1/);
    assert.match(converted.output, /pageInit: \(context\) =>/);

    const governance = JSON.parse(textResult(handle(call(8, 'netsuite_estimate_governance', {
        source: 'function demo() {\n  for (var i = 0; i < 2; i++) {\n    record.load({ type: "salesorder", id: i });\n  }\n}\n'
    }))));
    assert.strictEqual(governance.estimatedUnits, 10);
    assert.ok(governance.findings.some((item) => item.code === 'governance-loop'));

    const unknown = handle(call(9, 'netsuite_get_script_context', {}));
    assert.strictEqual(unknown[0].error.code, -32602);

    const missingQuery = handle(call(10, 'netsuite_lookup_api', {}));
    assert.strictEqual(missingQuery[0].result.isError, true);
    assert.match(missingQuery[0].result.content[0].text, /query is required/);

    const outside = handle(call(11, 'netsuite_convert_script', { filePath: path.join(os.tmpdir(), 'outside-the-workspace.js') }));
    assert.strictEqual(outside[0].result.isError, true);

    const ping = handle({ jsonrpc: '2.0', id: 12, method: 'ping' });
    assert.deepStrictEqual(ping[0].result, {});

    const missingMethod = handle({ jsonrpc: '2.0', id: 13, method: 'prompts/list' });
    assert.strictEqual(missingMethod[0].error.code, -32601);

    const snippetText = textResult(handle(call(14, 'netsuite_search_snippets', { query: 'MapReduce' })));
    assert.notStrictEqual(record, snippetText);
}

function testSdfAndLaunch() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-mcp-'));
    fs.writeFileSync(path.join(root, 'suitecloud.config.js'), "module.exports = { defaultProjectFolder: 'src' };\n");
    const scripts = path.join(root, 'src', 'FileCabinet', 'SuiteScripts');
    const objects = path.join(root, 'src', 'Objects');
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(objects, { recursive: true });
    const scriptPath = path.join(scripts, 'ue_customer.js');
    fs.writeFileSync(scriptPath, 'define([], function () { return {}; });\n');
    fs.writeFileSync(path.join(objects, 'customscript_ue.xml'), [
        '<usereventscript scriptid="customscript_ue">',
        '  <scriptid>customscript_ue</scriptid>',
        '  <scriptfile>[/SuiteScripts/ue_customer.js]</scriptfile>',
        '</usereventscript>',
        ''
    ].join('\n'));
    fs.mkdirSync(path.join(root, '.vscode'), { recursive: true });
    fs.writeFileSync(path.join(root, '.vscode', 'netsuite-suiteql-schema.json'), JSON.stringify({
        columns: { customer: ['custentity_example'] }
    }));

    const project = JSON.parse(textResult(handle(call(20, 'netsuite_get_sdf_project', {
        workspacePath: root,
        scriptPath
    }))));
    assert.ok(project.fileCabinetPath.includes(`${path.sep}FileCabinet`));
    assert.strictEqual(project.scriptCount, 1);
    assert.strictEqual(project.relatedObject.scriptId, 'customscript_ue');

    const columns = JSON.parse(textResult(handle(call(21, 'netsuite_get_suiteql_schema', {
        table: 'customer',
        workspacePath: root
    }))));
    assert.deepStrictEqual(columns.columns, ['custentity_example']);

    const launch = buildMcpLaunch({
        extensionPath,
        workspacePaths: [root, path.join(root, 'src')],
        execPath: process.execPath,
        version: '0.7.0'
    });
    assert.strictEqual(launch.command, process.execPath);
    assert.strictEqual(launch.args[0], path.join(extensionPath, 'mcp', 'server.js'));
    assert.strictEqual(launch.env.NETSUITE_EXTENSION_PATH, extensionPath);
    assert.strictEqual(launch.env.ELECTRON_RUN_AS_NODE, '1');
    assert.strictEqual(launch.env.NETSUITE_WORKSPACE, root);
    assert.strictEqual(launch.cwd, root);

    const pkg = require('../package.json');
    assert.ok(pkg.contributes.mcpServerDefinitionProviders.some((item) => item.id === PROVIDER_ID));
    assert.ok(pkg.activationEvents.includes(`onMcpServerDefinitionProvider:${PROVIDER_ID}`));
    fs.rmSync(root, { recursive: true, force: true });
}

function testFrames() {
    const first = Buffer.from('{"jsonrpc":"2.0","id":1,"method":"ping"}\n{"jsonrpc":"2.0","id":2');
    const split = extractFrames(first);
    assert.strictEqual(split.messages.length, 1);
    assert.match(split.rest.toString(), /"id":2/);

    const body = '{"jsonrpc":"2.0","id":3,"method":"ping"}';
    const framed = Buffer.from(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    const extracted = extractFrames(framed);
    assert.deepStrictEqual(extracted.messages, [body]);
    assert.strictEqual(extracted.rest.length, 0);
}

function call(id, name, args) {
    return {
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name, arguments: args }
    };
}

function textResult(responses) {
    assert.strictEqual(responses.length, 1);
    assert.strictEqual(responses[0].result.isError, false);
    return responses[0].result.content[0].text;
}

function testStdio() {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(extensionPath, 'mcp', 'server.js')], {
            cwd: extensionPath,
            env: { ...process.env, NETSUITE_EXTENSION_PATH: extensionPath }
        });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error(`MCP stdio timed out.\nstdout: ${stdout}\nstderr: ${stderr}`));
        }, 8000);

        function cleanup() {
            clearTimeout(timer);
            child.kill('SIGKILL');
        }

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
            const messages = stdout.split('\n').filter(Boolean).map((line) => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            }).filter(Boolean);
            const response = messages.find((message) => message.id === 3);
            if (!response) {
                return;
            }
            try {
                assert.strictEqual(response.result.isError, false);
                assert.match(response.result.content[0].text, /N\/record/);
                assert.doesNotMatch(response.result.content[0].text, /Copy AI Context/);
                assert.match(stderr, /listening on stdio/);
                cleanup();
                resolve();
            } catch (error) {
                cleanup();
                reject(error);
            }
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', (error) => {
            cleanup();
            reject(error);
        });

        const requests = [
            { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'stdio', version: '0' } } },
            { jsonrpc: '2.0', method: 'notifications/initialized' },
            { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'netsuite_lookup_api', arguments: { query: 'N/record', kind: 'modules' } } }
        ];
        child.stdin.write(`${requests.map((request) => JSON.stringify(request)).join('\n')}\n`);
    });
}

async function main() {
    testProtocol();
    testSdfAndLaunch();
    testFrames();
    await testStdio();
    console.log('MCP tests passed.');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
