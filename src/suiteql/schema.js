const path = require('path');
const fs = require('fs');
const { getFolderForUri, getWorkspaceFolders } = require('../utils/workspace');

function getSchemaPath(vscode, uri) {
    const folder = getFolderForUri(vscode, uri) || getWorkspaceFolders(vscode)[0];
    if (!folder) {
        return null;
    }

    const config = vscode.workspace.getConfiguration('netsuite', folder.uri);
    const relativePath = config.get('suiteqlSchemaPath', '.vscode/netsuite-suiteql-schema.json');
    return path.join(folder.uri.fsPath, relativePath);
}

function loadSchema(vscode, uri) {
    const schemaPath = getSchemaPath(vscode, uri);
    if (!schemaPath || !fs.existsSync(schemaPath)) {
        return { tables: {}, columns: {} };
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        return {
            tables: parsed.tables || {},
            columns: parsed.columns || {}
        };
    } catch {
        return { tables: {}, columns: {} };
    }
}

function getTableNames(schema, defaults = []) {
    const fromSchema = Object.keys(schema.tables || {});
    const fromColumns = Object.keys(schema.columns || {});
    return [...new Set([...defaults, ...fromSchema, ...fromColumns])].sort();
}

function getColumnsForTable(schema, tableName) {
    const key = tableName.toLowerCase();
    if (schema.columns[key]) {
        return schema.columns[key];
    }
    if (schema.tables[key]?.columns) {
        return schema.tables[key].columns;
    }
    return [];
}

module.exports = {
    getSchemaPath,
    loadSchema,
    getTableNames,
    getColumnsForTable
};
