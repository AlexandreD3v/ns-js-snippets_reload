#!/usr/bin/env node
/**
 * Minimal read-only MCP-style stdio server for NetSuite workspace context.
 * This is intentionally lightweight and does not connect to NetSuite accounts.
 */
const readline = require('readline');

const tools = {
    netsuite_get_script_context: {
        description: 'Returns guidance on using the VS Code extension context builder.',
        inputSchema: { type: 'object', properties: {} }
    }
};

function send(message) {
    process.stdout.write(`${JSON.stringify(message)}\n`);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
    let request;
    try {
        request = JSON.parse(line);
    } catch {
        return;
    }

    if (request.method === 'initialize') {
        send({ jsonrpc: '2.0', id: request.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'ns-js-snippets-mcp', version: '0.7.0' } } });
        return;
    }

    if (request.method === 'tools/list') {
        send({
            jsonrpc: '2.0',
            id: request.id,
            result: {
                tools: Object.entries(tools).map(([name, tool]) => ({
                    name,
                    description: tool.description,
                    inputSchema: tool.inputSchema
                }))
            }
        });
        return;
    }

    if (request.method === 'tools/call') {
        send({
            jsonrpc: '2.0',
            id: request.id,
            result: {
                content: [{
                    type: 'text',
                    text: 'Use the VS Code command "NetSuite: Copy AI Context" or LM tools from the extension for live workspace context.'
                }]
            }
        });
        return;
    }

    send({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } });
});
