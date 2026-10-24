const { ToolError } = require('./tools');

const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_PROTOCOL = '2025-03-26';

const INSTRUCTIONS = [
    'Local read-only NetSuite helper for SuiteScript development.',
    'Tools use this extension\'s bundled module, snippet, governance, and SuiteQL metadata, plus SuiteCloud files in the workspace.',
    'They do not connect to a NetSuite account and do not run the SuiteCloud CLI.'
].join(' ');

function createProtocolHandler({ catalog, serverInfo }) {
    return function handle(message) {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return [errorResponse(null, -32600, 'Invalid Request')];
        }

        const notification = message.id === undefined;
        if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled') {
            return [];
        }
        if (!message.method || typeof message.method !== 'string') {
            return notification ? [] : [errorResponse(message.id ?? null, -32600, 'Invalid Request')];
        }

        try {
            if (message.method === 'initialize') {
                const requested = message.params?.protocolVersion;
                const protocolVersion = SUPPORTED_PROTOCOLS.includes(requested) ? requested : DEFAULT_PROTOCOL;
                return [resultResponse(message.id, {
                    protocolVersion,
                    capabilities: { tools: { listChanged: false } },
                    serverInfo,
                    instructions: INSTRUCTIONS
                })];
            }
            if (message.method === 'ping') {
                return [resultResponse(message.id, {})];
            }
            if (message.method === 'tools/list') {
                return [resultResponse(message.id, { tools: catalog.list() })];
            }
            if (message.method === 'tools/call') {
                return [callTool(message, catalog)];
            }
            if (notification) {
                return [];
            }
            return [errorResponse(message.id, -32601, `Method not found: ${message.method}`)];
        } catch (error) {
            if (notification) {
                return [];
            }
            return [errorResponse(message.id, -32603, error.message || 'Internal error')];
        }
    };
}

function callTool(message, catalog) {
    const params = message.params;
    if (!params || typeof params !== 'object' || typeof params.name !== 'string' || !params.name) {
        return errorResponse(message.id, -32602, 'Invalid params: tool name is required.');
    }
    if (params.arguments != null && (typeof params.arguments !== 'object' || Array.isArray(params.arguments))) {
        return errorResponse(message.id, -32602, 'Invalid params: arguments must be an object.');
    }

    try {
        const payload = catalog.call(params.name, params.arguments || {});
        return resultResponse(message.id, {
            content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
            isError: false
        });
    } catch (error) {
        if (error instanceof ToolError && error.code === 'UNKNOWN_TOOL') {
            return errorResponse(message.id, -32602, error.message);
        }
        const messageText = error?.message || 'Tool execution failed.';
        return resultResponse(message.id, {
            content: [{ type: 'text', text: messageText }],
            isError: true
        });
    }
}

function resultResponse(id, result) {
    return { jsonrpc: '2.0', id, result };
}

function errorResponse(id, code, message) {
    return { jsonrpc: '2.0', id, error: { code, message } };
}

function extractFrames(buffer) {
    const messages = [];
    let rest = buffer;
    while (rest.length > 0) {
        const prefix = rest.slice(0, Math.min(rest.length, 20)).toString('utf8');
        if (prefix.startsWith('Content-Length')) {
            const header = indexOfHeaderEnd(rest);
            if (!header) {
                break;
            }
            const headers = rest.slice(0, header.index).toString('utf8');
            const match = headers.match(/Content-Length:\s*(\d+)/i);
            if (!match) {
                rest = rest.slice(header.index + header.length);
                continue;
            }
            const length = Number(match[1]);
            const bodyStart = header.index + header.length;
            if (rest.length < bodyStart + length) {
                break;
            }
            messages.push(rest.slice(bodyStart, bodyStart + length).toString('utf8'));
            rest = rest.slice(bodyStart + length);
            continue;
        }

        const newline = rest.indexOf(0x0a);
        if (newline < 0) {
            break;
        }
        messages.push(rest.slice(0, newline).toString('utf8').replace(/\r$/, ''));
        rest = rest.slice(newline + 1);
    }
    return { messages: messages.filter((line) => line.trim()), rest };
}

function indexOfHeaderEnd(buffer) {
    const crlf = buffer.indexOf('\r\n\r\n');
    if (crlf >= 0) {
        return { index: crlf, length: 4 };
    }
    const lf = buffer.indexOf('\n\n');
    if (lf >= 0) {
        return { index: lf, length: 2 };
    }
    return null;
}

module.exports = {
    SUPPORTED_PROTOCOLS,
    DEFAULT_PROTOCOL,
    INSTRUCTIONS,
    createProtocolHandler,
    extractFrames
};
