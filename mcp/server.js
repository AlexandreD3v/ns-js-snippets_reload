#!/usr/bin/env node
/**
 * Workspace-aware MCP stdio server for NetSuite extension context.
 * Set NS_MCP_WORKSPACE to the SuiteCloud / SuiteScript workspace root.
 */
const readline = require('readline');
const { buildFileContext, buildWorkspaceSummary, resolveWorkspaceRoot } = require('./workspaceContext');

const SERVER_VERSION = '0.8.0';

const tools = {
    netsuite_get_workspace_summary: {
        description: 'Summarize the NetSuite workspace: SDF project, script files, and local SuiteQL schema tables.',
        inputSchema: { type: 'object', properties: {} }
    },
    netsuite_get_file_context: {
        description: 'Return sanitized SuiteScript/SuiteQL analysis for a workspace-relative file path.',
        inputSchema: {
            type: 'object',
            properties: {
                relativePath: { type: 'string', description: 'Path relative to NS_MCP_WORKSPACE' },
                includeFileContent: { type: 'boolean', description: 'Include full file text in the payload' }
            },
            required: ['relativePath']
        }
    },
    netsuite_list_sdf_script_objects: {
        description: 'List SDF script object links (script file ↔ Objects XML) for the workspace project.',
        inputSchema: { type: 'object', properties: {} }
    }
};

function send(message) {
    process.stdout.write(`${JSON.stringify(message)}\n`);
}

function toolText(payload) {
    return {
        content: [{
            type: 'text',
            text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
        }]
    };
}

function handleToolCall(name, args = {}) {
    const workspaceRoot = resolveWorkspaceRoot();

    if (name === 'netsuite_get_workspace_summary') {
        return toolText(buildWorkspaceSummary(workspaceRoot));
    }

    if (name === 'netsuite_get_file_context') {
        return toolText(buildFileContext(workspaceRoot, args.relativePath, {
            includeFileContent: Boolean(args.includeFileContent)
        }));
    }

    if (name === 'netsuite_list_sdf_script_objects') {
        const { buildIndex } = require('../src/sdf/sdfIndex');
        const { findProjectRootFromPath } = require('../src/services/suitecloudRunner');
        const projectRoot = findProjectRootFromPath(workspaceRoot, workspaceRoot);
        if (!projectRoot) {
            return toolText({ error: 'No SuiteCloud project detected in workspace.', workspaceRoot });
        }
        const index = buildIndex(projectRoot);
        return toolText(index.scriptObjects.map((item) => ({
            scriptId: item.scriptId,
            scriptFile: item.scriptFile,
            objectPath: item.objectPath
        })));
    }

    throw new Error(`Unknown tool: ${name}`);
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
        send({
            jsonrpc: '2.0',
            id: request.id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'ns-js-snippets-mcp', version: SERVER_VERSION }
            }
        });
        return;
    }

    if (request.method === 'notifications/initialized') {
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
        try {
            const args = request.params?.arguments || {};
            send({
                jsonrpc: '2.0',
                id: request.id,
                result: handleToolCall(request.params?.name, args)
            });
        } catch (error) {
            send({
                jsonrpc: '2.0',
                id: request.id,
                result: toolText({ error: error.message, workspaceRoot: resolveWorkspaceRoot() })
            });
        }
        return;
    }

    if (request.id !== undefined) {
        send({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } });
    }
});
