const fs = require('fs');
const path = require('path');
const { loadData } = require('../src/utils/dataLoader');
const { analyzeText } = require('../src/analysis/suiteScriptAnalyzer');
const { analyzeSuiteQLInJavaScript, analyzeSuiteQLText } = require('../src/suiteql/suiteqlAnalyzer');
const { analyzeGovernance } = require('../src/analysis/governanceAnalyzer');
const { auditText } = require('../src/migration/audit');
const {
    detectScriptType,
    detectImportedModules,
    getApiVersion
} = require('../src/utils/parseSuiteScript');
const { normalizeSchema, loadSchemaFile } = require('../src/suiteql/schemaImport');
const { buildIndex } = require('../src/sdf/sdfIndex');
const { findProjectRootFromPath } = require('../src/services/suitecloudRunner');

function resolveWorkspaceRoot() {
    const fromEnv = process.env.NS_MCP_WORKSPACE;
    if (fromEnv && fs.existsSync(fromEnv)) {
        return path.resolve(fromEnv);
    }
    return process.cwd();
}

function resolveFilePath(workspaceRoot, relativePath) {
    if (!relativePath) {
        return null;
    }
    const absolute = path.isAbsolute(relativePath)
        ? path.resolve(relativePath)
        : path.resolve(workspaceRoot, relativePath);
    if (!absolute.startsWith(workspaceRoot)) {
        throw new Error('File path must stay inside the workspace root.');
    }
    if (!fs.existsSync(absolute)) {
        throw new Error(`File not found: ${relativePath}`);
    }
    return absolute;
}

function loadWorkspaceSchema(workspaceRoot) {
    const schemaPath = path.join(workspaceRoot, '.vscode', 'netsuite-suiteql-schema.json');
    if (!fs.existsSync(schemaPath)) {
        return { schema: { tables: {}, columns: {} }, schemaPath: null };
    }
    return {
        schema: normalizeSchema(JSON.parse(fs.readFileSync(schemaPath, 'utf8'))),
        schemaPath
    };
}

function collectTextFindings(text, languageId, data) {
    if (languageId === 'suiteql') {
        return analyzeSuiteQLText(text);
    }
    const findings = [...analyzeText(text, data), ...analyzeSuiteQLInJavaScript(text)];
    if (data.governance) {
        findings.push(...analyzeGovernance(text, data.governance).findings);
    }
    return findings;
}

function buildFileContext(workspaceRoot, relativePath, options = {}) {
    const absolutePath = resolveFilePath(workspaceRoot, relativePath);
    const text = fs.readFileSync(absolutePath, 'utf8');
    const languageId = absolutePath.endsWith('.suiteql') ? 'suiteql' : 'javascript';
    const extensionPath = options.extensionPath || path.resolve(__dirname, '..');
    const data = loadData(extensionPath);

    const context = {
        workspaceRoot,
        fileName: path.basename(absolutePath),
        relativePath: path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/'),
        languageId,
        apiVersion: getApiVersion(text),
        scriptType: detectScriptType(text),
        imports: detectImportedModules(text),
        diagnostics: collectTextFindings(text, languageId, data).map((item) => ({
            line: item.line + 1,
            severity: item.severity,
            message: item.message,
            code: item.code
        })),
        migration: auditText(text, absolutePath),
        fileContent: options.includeFileContent ? text : undefined
    };

    const projectRoot = findProjectRootFromPath(absolutePath, workspaceRoot);
    if (projectRoot) {
        const index = buildIndex(projectRoot);
        context.sdf = {
            projectRoot,
            scriptObjectCount: index.scriptObjects.length,
            discoveredFieldCount: index.fieldIds.length,
            relatedScriptObject: index.scriptObjects.find((item) => path.resolve(item.scriptPath) === path.resolve(absolutePath)) || null
        };
    }

    return context;
}

function buildWorkspaceSummary(workspaceRoot, options = {}) {
    const extensionPath = options.extensionPath || path.resolve(__dirname, '..');
    const data = loadData(extensionPath);
    const { schema, schemaPath } = loadWorkspaceSchema(workspaceRoot);
    const projectRoot = findProjectRootFromPath(workspaceRoot, workspaceRoot);
    const summary = {
        workspaceRoot,
        suiteqlSchemaPath: schemaPath,
        suiteqlTables: Object.keys(schema.columns).sort(),
        bundledSuiteqlTables: (data.suiteqlTables || []).map((item) => item.label),
        sdf: null,
        scriptFiles: []
    };

    if (projectRoot) {
        const index = buildIndex(projectRoot);
        summary.sdf = {
            projectRoot,
            scriptObjectCount: index.scriptObjects.length,
            scriptFileCount: index.scriptFiles.length,
            discoveredFieldCount: index.fieldIds.length
        };
        summary.scriptFiles = index.scriptFiles.slice(0, 50).map((item) => item.relativePath);
    }

    return summary;
}

module.exports = {
    resolveWorkspaceRoot,
    buildFileContext,
    buildWorkspaceSummary
};
