#!/usr/bin/env node
const path = require('path');
const { createToolCatalog, SERVER_NAME } = require('../src/mcp/tools');
const { createProtocolHandler, extractFrames } = require('../src/mcp/protocol');

const extensionPath = process.env.NETSUITE_EXTENSION_PATH || path.join(__dirname, '..');
const packageInfo = require(path.join(extensionPath, 'package.json'));
const catalog = createToolCatalog(extensionPath);
const handle = createProtocolHandler({
    catalog,
    serverInfo: {
        name: SERVER_NAME,
        version: packageInfo.version || '0.7.0'
    }
});

function accept(payload) {
    let message;
    try {
        message = JSON.parse(payload);
    } catch {
        write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        return;
    }
    if (Array.isArray(message)) {
        write({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } });
        return;
    }
    for (const response of handle(message)) {
        write(response);
    }
}

function write(message) {
    process.stdout.write(`${JSON.stringify(message)}\n`);
}

let buffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const extracted = extractFrames(buffer);
    buffer = extracted.rest;
    for (const payload of extracted.messages) {
        try {
            accept(payload);
        } catch (error) {
            process.stderr.write(`${error.stack || error.message}\n`);
        }
    }
});

process.stdin.on('error', (error) => {
    process.stderr.write(`${error.message}\n`);
});

process.stderr.write(`NetSuite MCP server listening on stdio (${SERVER_NAME} ${packageInfo.version || '0.7.0'})\n`);
