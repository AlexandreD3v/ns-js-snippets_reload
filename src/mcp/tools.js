const fs = require('fs');
const path = require('path');
const { loadData } = require('../utils/dataLoader');
const { findProjectRootFromPath, getProjectInfo } = require('../services/suitecloudRunner');
const { buildIndex, findScriptObjectForFile } = require('../sdf/sdfIndex');
const { convertTo21 } = require('../migration/convert');
const { analyzeGovernance } = require('../analysis/governanceAnalyzer');

const SERVER_NAME = 'ns-js-snippets-mcp';
const PROVIDER_ID = 'netsuite-suitescript';

class ToolError extends Error {
    constructor(message, code = 'INVALID') {
        super(message);
        this.name = 'ToolError';
        this.code = code;
    }
}

function createToolCatalog(extensionPath) {
    const data = loadData(extensionPath);
    const snippets = loadSnippets(extensionPath);
    const tools = [
        defineTool({
            name: 'netsuite_lookup_api',
            title: 'Look up SuiteScript API',
            description: 'Look up bundled SuiteScript modules, annotations, entry points, enums, and governance costs. This is local extension metadata, not a live NetSuite account.',
            properties: {
                query: { type: 'string', description: 'Module (N/record), annotation, entry point, enum, or API name to search for.' },
                kind: {
                    type: 'string',
                    enum: ['all', 'modules', 'annotations', 'entryPoints', 'enums', 'governance'],
                    description: 'Which catalog to search. Defaults to all.'
                }
            },
            required: ['query'],
            handler: (args) => lookupApi(data, args)
        }),
        defineTool({
            name: 'netsuite_search_snippets',
            title: 'Search SuiteScript snippets',
            description: 'Search the extension snippet catalog by name, prefix, or body text and return a short preview.',
            properties: {
                query: { type: 'string', description: 'Text matched against snippet name, prefix, description, and body.' },
                limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Maximum matches to return. Defaults to 8.' }
            },
            required: ['query'],
            handler: (args) => searchSnippets(snippets, args)
        }),
        defineTool({
            name: 'netsuite_get_suiteql_schema',
            title: 'Get SuiteQL schema',
            description: 'Return bundled SuiteQL tables and, when a workspace path is provided, columns from .vscode/netsuite-suiteql-schema.json. This is not a live account schema.',
            properties: {
                table: { type: 'string', description: 'Optional table name, such as customer or transactionline.' },
                workspacePath: { type: 'string', description: 'Optional workspace folder used to load the local schema override.' }
            },
            handler: (args) => getSuiteQLSchema(data, args)
        }),
        defineTool({
            name: 'netsuite_get_sdf_project',
            title: 'Get SDF project info',
            description: 'Read a local SuiteCloud project (suitecloud.config.js or manifest.xml) and summarize script objects and custom field ids. Does not call NetSuite or the SuiteCloud CLI.',
            properties: {
                workspacePath: { type: 'string', description: 'Project or workspace folder. Defaults to NETSUITE_WORKSPACE or the server working directory.' },
                scriptPath: { type: 'string', description: 'Optional script file used to find the related SDF object XML.' }
            },
            handler: (args) => getSdfProject(args)
        }),
        defineTool({
            name: 'netsuite_convert_script',
            title: 'Convert SuiteScript to 2.1',
            description: 'Audit a SuiteScript source and return a SuiteScript 2.1 conversion preview. Does not write files.',
            properties: {
                source: { type: 'string', description: 'SuiteScript source text. Use this or filePath.' },
                filePath: { type: 'string', description: 'Workspace file to read. Must stay inside the resolved workspace.' }
            },
            handler: (args) => convertScript(args)
        }),
        defineTool({
            name: 'netsuite_estimate_governance',
            title: 'Estimate governance usage',
            description: 'Estimate SuiteScript governance units for known calls such as record.load and search.run, including calls inside loops.',
            properties: {
                source: { type: 'string', description: 'SuiteScript source text. Use this or filePath.' },
                filePath: { type: 'string', description: 'Workspace file to read. Must stay inside the resolved workspace.' }
            },
            handler: (args) => estimateGovernance(data, args)
        })
    ];

    return {
        list() {
            return tools.map((tool) => ({
                name: tool.name,
                title: tool.title,
                description: tool.description,
                inputSchema: tool.inputSchema,
                annotations: tool.annotations
            }));
        },
        call(name, args) {
            const tool = tools.find((item) => item.name === name);
            if (!tool) {
                throw new ToolError(`Unknown tool "${name}".`, 'UNKNOWN_TOOL');
            }
            return tool.handler(args && typeof args === 'object' ? args : {});
        }
    };
}

function defineTool({ name, title, description, properties, required, handler }) {
    return {
        name,
        title,
        description,
        inputSchema: {
            type: 'object',
            properties,
            required: required || [],
            additionalProperties: false
        },
        annotations: {
            title,
            readOnlyHint: true
        },
        handler
    };
}

function lookupApi(data, args) {
    const query = requireString(args.query, 'query');
    if (query.length < 2) {
        throw new ToolError('query must be at least 2 characters.');
    }
    const kind = args.kind || 'all';
    const allowed = new Set(['all', 'modules', 'annotations', 'entryPoints', 'enums', 'governance']);
    if (!allowed.has(kind)) {
        throw new ToolError(`kind must be one of ${[...allowed].join(', ')}.`);
    }
    const needle = query.toLowerCase();
    const result = { query, kind };
    if (kind === 'all' || kind === 'modules') {
        result.modules = data.modules.filter((item) => includesAny(needle, item.label, item.documentation)).slice(0, 20);
    }
    if (kind === 'all' || kind === 'annotations') {
        result.annotations = data.annotations.filter((item) => includesAny(needle, item.label, item.documentation)).slice(0, 20);
    }
    if (kind === 'all' || kind === 'entryPoints') {
        result.entryPoints = searchEntryPoints(data.entryPoints, needle);
    }
    if (kind === 'all' || kind === 'enums') {
        result.enums = searchEnums(data.enums, needle);
    }
    if (kind === 'all' || kind === 'governance') {
        result.governance = Object.entries(data.governance)
            .filter(([name]) => name.toLowerCase().includes(needle))
            .map(([name, units]) => ({ name, units }));
    }
    return result;
}

function searchEntryPoints(entryPoints, needle) {
    const matches = [];
    const normalizedNeedle = needle.replace(/[^a-z0-9]/g, '');
    for (const [scriptType, points] of Object.entries(entryPoints)) {
        const typeMatches = scriptType.includes(normalizedNeedle);
        for (const point of points) {
            if (typeMatches || point.label.toLowerCase().includes(needle) || (point.documentation || '').toLowerCase().includes(needle)) {
                matches.push({
                    scriptType,
                    name: point.label,
                    parameterName: point.parameterName,
                    documentation: point.documentation,
                    validator: point.validator
                });
            }
        }
    }
    return matches.slice(0, 40);
}

function searchEnums(enums, needle) {
    const matches = [];
    for (const [moduleName, groups] of Object.entries(enums)) {
        for (const [group, values] of Object.entries(groups)) {
            for (const value of values) {
                if (includesAny(needle, moduleName, group, value.label, value.documentation)) {
                    matches.push({
                        module: moduleName,
                        group,
                        name: value.label,
                        documentation: value.documentation
                    });
                }
            }
        }
    }
    return matches.slice(0, 30);
}

function searchSnippets(snippets, args) {
    const query = requireString(args.query, 'query');
    if (query.length < 2) {
        throw new ToolError('query must be at least 2 characters.');
    }
    const limit = clampInteger(args.limit, 8, 1, 20);
    const needle = query.toLowerCase();
    const matches = [];
    for (const [name, snippet] of Object.entries(snippets)) {
        const body = Array.isArray(snippet.body) ? snippet.body : [];
        const haystack = [name, snippet.prefix, snippet.description, ...body].join('\n').toLowerCase();
        if (!haystack.includes(needle)) {
            continue;
        }
        matches.push({
            name,
            prefix: snippet.prefix,
            description: snippet.description || '',
            preview: body.slice(0, 25).join('\n')
        });
        if (matches.length >= limit) {
            break;
        }
    }
    return { query, count: matches.length, matches };
}

function getSuiteQLSchema(data, args) {
    const workspacePath = resolveWorkspace(args);
    const override = readWorkspaceSchema(workspacePath);
    const bundled = data.suiteqlTables.map((table) => ({
        name: table.label,
        documentation: table.documentation
    }));
    if (!args.table) {
        return {
            bundled,
            workspaceSchemaPath: override.path,
            workspaceTables: override.tableNames
        };
    }
    const table = String(args.table).trim().toLowerCase();
    const known = bundled.find((item) => item.name.toLowerCase() === table) || null;
    const columns = override.columns[table] || override.tables[table]?.columns || [];
    if (!known && columns.length === 0) {
        throw new ToolError(`No bundled or workspace SuiteQL metadata for "${table}".`);
    }
    return {
        table,
        bundled: known,
        columns,
        workspaceSchemaPath: override.path
    };
}

function getSdfProject(args) {
    const scriptPath = optionalPath(args.scriptPath);
    const roots = workspaceCandidates(args);
    let projectRoot = null;
    if (scriptPath) {
        assertInsideWorkspace(scriptPath, roots);
        projectRoot = findProjectRootFromPath(scriptPath, roots[0]) || findNestedProject(path.dirname(scriptPath));
    }
    if (!projectRoot) {
        for (const root of roots) {
            projectRoot = findNestedProject(root);
            if (projectRoot) {
                break;
            }
        }
    }
    if (!projectRoot) {
        throw new ToolError('No SuiteCloud project found. Pass workspacePath pointing at a folder with suitecloud.config.js or manifest.xml.');
    }

    const info = getProjectInfo(projectRoot);
    const index = buildIndex(projectRoot);
    const related = scriptPath ? findScriptObjectForFile(index, scriptPath) : null;
    return {
        root: info.root,
        projectFolder: info.projectFolder,
        projectType: info.projectType,
        manifestPath: info.manifestPath,
        fileCabinetPath: info.fileCabinetPath,
        objectsPath: info.objectsPath,
        scriptCount: index.scriptObjects.length,
        scriptIds: index.scriptIds.slice(0, 50),
        fieldIds: index.fieldIds.slice(0, 80),
        relatedObject: related ? {
            scriptId: related.scriptId,
            objectPath: related.objectPath,
            scriptFile: related.scriptFile
        } : null
    };
}

function convertScript(args) {
    const source = readSource(args);
    const converted = convertTo21(source.text);
    return {
        filePath: source.filePath,
        changed: converted.changed,
        audit: {
            apiVersion: converted.audit.apiVersion,
            scriptType: converted.audit.scriptType,
            needsUpgrade: converted.audit.needsUpgrade,
            info: converted.audit.info,
            manualReview: converted.audit.manualReview
        },
        output: converted.output
    };
}

function estimateGovernance(data, args) {
    const source = readSource(args);
    const report = analyzeGovernance(source.text, data.governance);
    return {
        filePath: source.filePath,
        estimatedUnits: report.estimatedUnits,
        findings: report.findings
    };
}

function readSource(args) {
    if (typeof args.source === 'string' && args.source.trim()) {
        return { text: args.source, filePath: null };
    }
    const filePath = optionalPath(args.filePath);
    if (!filePath) {
        throw new ToolError('Provide source or filePath.');
    }
    assertInsideWorkspace(filePath, workspaceCandidates(args));
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw new ToolError(`File not found: ${filePath}`);
    }
    return { text: fs.readFileSync(filePath, 'utf8'), filePath };
}

function optionalPath(value) {
    if (value == null || value === '') {
        return null;
    }
    if (typeof value !== 'string') {
        throw new ToolError('filePath must be a string.');
    }
    return path.resolve(value);
}

function workspaceCandidates(args) {
    const candidates = [];
    if (typeof args.workspacePath === 'string' && args.workspacePath.trim()) {
        candidates.push(args.workspacePath);
    }
    if (process.env.NETSUITE_WORKSPACE) {
        candidates.push(process.env.NETSUITE_WORKSPACE);
    }
    if (process.env.NETSUITE_WORKSPACES) {
        try {
            const parsed = JSON.parse(process.env.NETSUITE_WORKSPACES);
            if (Array.isArray(parsed)) {
                candidates.push(...parsed.filter((item) => typeof item === 'string'));
            }
        } catch {
            // Ignore a malformed env value and fall back to the working directory.
        }
    }
    candidates.push(process.cwd());
    return [...new Set(candidates.map((item) => path.resolve(item)))];
}

function resolveWorkspace(args) {
    return workspaceCandidates(args)[0];
}

function assertInsideWorkspace(targetPath, roots) {
    const resolved = path.resolve(targetPath);
    const allowed = roots.some((root) => {
        const relative = path.relative(root, resolved);
        return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
    if (!allowed) {
        throw new ToolError('Path is outside the workspace.');
    }
}

function findNestedProject(root) {
    if (!root || !fs.existsSync(root)) {
        return null;
    }
    const direct = findProjectRootFromPath(root, root);
    if (direct) {
        return direct;
    }
    const stack = [{ dir: root, depth: 0 }];
    while (stack.length > 0) {
        const current = stack.pop();
        if (current.depth > 4) {
            continue;
        }
        let entries;
        try {
            entries = fs.readdirSync(current.dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (entry.name === 'suitecloud.config.js') {
                return current.dir;
            }
            if (entry.name === 'manifest.xml') {
                const resolved = findProjectRootFromPath(current.dir, root);
                if (resolved) {
                    return resolved;
                }
            }
            if (entry.isDirectory() && !['node_modules', '.git', 'FileCabinet', 'dist', 'coverage'].includes(entry.name)) {
                stack.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 });
            }
        }
    }
    return null;
}

function readWorkspaceSchema(workspacePath) {
    const schemaPath = path.join(workspacePath, '.vscode', 'netsuite-suiteql-schema.json');
    if (!fs.existsSync(schemaPath)) {
        return { path: null, tables: {}, columns: {}, tableNames: [] };
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        const tables = parsed.tables || {};
        const columns = parsed.columns || {};
        return {
            path: schemaPath,
            tables,
            columns,
            tableNames: [...new Set([...Object.keys(tables), ...Object.keys(columns)])].sort()
        };
    } catch (error) {
        throw new ToolError(`Could not read SuiteQL schema: ${error.message}`);
    }
}

function loadSnippets(extensionPath) {
    const snippetPath = path.join(extensionPath, 'snippets', 'snippets.code-snippets');
    return parseJsonc(fs.readFileSync(snippetPath, 'utf8'));
}

function parseJsonc(text) {
    let withoutComments = '';
    let inString = false;
    let escaped = false;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            withoutComments += char;
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
            withoutComments += char;
            continue;
        }
        if (char === '/' && text[index + 1] === '/') {
            while (index < text.length && text[index] !== '\n') {
                index += 1;
            }
            withoutComments += '\n';
            continue;
        }
        if (char === '/' && text[index + 1] === '*') {
            index += 2;
            while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) {
                index += 1;
            }
            index += 1;
            continue;
        }
        withoutComments += char;
    }

    let json = '';
    inString = false;
    escaped = false;
    for (let index = 0; index < withoutComments.length; index += 1) {
        const char = withoutComments[index];
        if (inString) {
            json += char;
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
            json += char;
            continue;
        }
        if (char === ',') {
            let lookAhead = index + 1;
            while (lookAhead < withoutComments.length && /\s/.test(withoutComments[lookAhead])) {
                lookAhead += 1;
            }
            if (withoutComments[lookAhead] === '}' || withoutComments[lookAhead] === ']') {
                continue;
            }
        }
        json += char;
    }
    return JSON.parse(json);
}

function requireString(value, name) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new ToolError(`${name} is required.`);
    }
    return value.trim();
}

function includesAny(needle, ...parts) {
    return parts.some((part) => String(part || '').toLowerCase().includes(needle));
}

function clampInteger(value, fallback, min, max) {
    if (value == null || value === '') {
        return fallback;
    }
    const number = Number(value);
    if (!Number.isInteger(number)) {
        throw new ToolError('limit must be an integer.');
    }
    return Math.min(max, Math.max(min, number));
}

function buildMcpLaunch({ extensionPath, workspacePaths = [], execPath, version }) {
    const folders = workspacePaths.filter((item) => typeof item === 'string' && item.trim());
    const env = {
        NETSUITE_EXTENSION_PATH: extensionPath,
        // VS Code's process.execPath is Electron. This makes it run the server as Node.
        ELECTRON_RUN_AS_NODE: '1'
    };
    if (folders[0]) {
        env.NETSUITE_WORKSPACE = folders[0];
    }
    if (folders.length > 1) {
        env.NETSUITE_WORKSPACES = JSON.stringify(folders);
    }
    return {
        label: 'NetSuite SuiteScript',
        command: execPath,
        args: [path.join(extensionPath, 'mcp', 'server.js')],
        env,
        cwd: folders[0] || extensionPath,
        version
    };
}

module.exports = {
    SERVER_NAME,
    PROVIDER_ID,
    ToolError,
    createToolCatalog,
    buildMcpLaunch
};
