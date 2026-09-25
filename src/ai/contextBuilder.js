const path = require('path');
const { collectFindings } = require('../providers/diagnosticProvider');
const { auditText } = require('../migration/audit');
const { detectScriptType, detectImportedModules, getApiVersion } = require('../utils/parseSuiteScript');
const { loadSchema, getTableNames } = require('../suiteql/schema');
const { buildIndex } = require('../sdf/sdfIndex');
const { findSuiteCloudProjectRoot } = require('../services/suitecloudRunner');

function buildContext(vscode, document, data, options = {}) {
    const text = document.getText();
    const includeFileContent = Boolean(options.includeFileContent);
    const includeCustomFields = Boolean(options.includeCustomFields);

    const context = {
        fileName: path.basename(document.fileName),
        languageId: document.languageId,
        apiVersion: getApiVersion(text),
        scriptType: detectScriptType(text),
        imports: detectImportedModules(text),
        diagnostics: collectFindings(vscode, document, data).map((item) => ({
            line: item.line + 1,
            severity: item.severity,
            message: item.message,
            code: item.code
        })),
        migration: auditText(text, document.fileName),
        suiteqlSchema: summarizeSchema(loadSchema(vscode, document.uri), data.suiteqlTables),
        sdf: summarizeSdf(vscode, document.uri),
        customFieldsIncluded: false,
        fileContent: includeFileContent ? text : undefined
    };

    if (includeCustomFields && options.customFieldStore) {
        context.customFieldsIncluded = true;
        context.customFieldCount = options.customFieldStore.get(document.uri).allFields.length;
    }

    return sanitizeContext(context);
}

function summarizeSchema(schema, defaults) {
    return {
        tables: getTableNames(schema, (defaults || []).map((item) => item.label))
    };
}

function summarizeSdf(vscode, uri) {
    const root = findSuiteCloudProjectRoot(vscode, uri);
    if (!root) {
        return null;
    }
    const index = buildIndex(root);
    return {
        projectRoot: root,
        scriptObjectCount: index.scriptObjects.length,
        discoveredFieldCount: index.fieldIds.length
    };
}

function sanitizeContext(context) {
    const clone = JSON.parse(JSON.stringify(context));
    delete clone.customFieldIds;
    return clone;
}

module.exports = {
    buildContext,
    sanitizeContext
};
