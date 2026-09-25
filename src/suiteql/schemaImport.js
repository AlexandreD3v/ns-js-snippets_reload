const fs = require('fs');
const path = require('path');

function emptySchema() {
    return { tables: {}, columns: {} };
}

function normalizeSchema(raw) {
    const schema = emptySchema();
    if (!raw || typeof raw !== 'object') {
        return schema;
    }

    if (raw.tables && typeof raw.tables === 'object') {
        for (const [tableName, tableValue] of Object.entries(raw.tables)) {
            const key = tableName.toLowerCase();
            if (Array.isArray(tableValue)) {
                schema.columns[key] = mergeColumns(schema.columns[key], tableValue);
            } else if (tableValue && typeof tableValue === 'object') {
                schema.tables[key] = {
                    label: tableValue.label || tableName,
                    columns: mergeColumns([], tableValue.columns || [])
                };
                schema.columns[key] = mergeColumns(schema.columns[key], tableValue.columns || []);
            }
        }
    }

    if (raw.columns && typeof raw.columns === 'object') {
        for (const [tableName, columns] of Object.entries(raw.columns)) {
            const key = tableName.toLowerCase();
            schema.columns[key] = mergeColumns(schema.columns[key], columns);
        }
    }

    return schema;
}

function mergeColumns(existing, incoming) {
    const list = [...(existing || []), ...(incoming || [])]
        .map((item) => String(item).trim())
        .filter(Boolean);
    return [...new Set(list)].sort();
}

function mergeSchemas(base, incoming) {
    const merged = normalizeSchema(base);
    const extra = normalizeSchema(incoming);

    for (const [tableName, tableMeta] of Object.entries(extra.tables)) {
        merged.tables[tableName] = {
            label: tableMeta.label || merged.tables[tableName]?.label || tableName,
            columns: mergeColumns(merged.tables[tableName]?.columns, tableMeta.columns)
        };
        merged.columns[tableName] = mergeColumns(merged.columns[tableName], tableMeta.columns);
    }

    for (const [tableName, columns] of Object.entries(extra.columns)) {
        merged.columns[tableName] = mergeColumns(merged.columns[tableName], columns);
    }

    return merged;
}

function parseCsvSchema(text) {
    const schema = emptySchema();
    const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#'));

    for (const line of lines) {
        const parts = line.split(',').map((part) => part.trim());
        if (parts.length < 2) {
            continue;
        }
        const tableName = parts[0].toLowerCase();
        const columnName = parts[1].toLowerCase();
        schema.columns[tableName] = mergeColumns(schema.columns[tableName], [columnName]);
        if (!schema.tables[tableName]) {
            schema.tables[tableName] = { label: parts[0], columns: [] };
        }
        schema.tables[tableName].columns = mergeColumns(schema.tables[tableName].columns, [columnName]);
    }

    return schema;
}

function loadSchemaFile(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.csv') {
        return parseCsvSchema(text);
    }

    return normalizeSchema(JSON.parse(text));
}

function writeSchemaFile(filePath, schema) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(normalizeSchema(schema), null, 2)}\n`, 'utf8');
}

function importSchemaFile(sourcePath, targetPath) {
    const incoming = loadSchemaFile(sourcePath);
    let existing = emptySchema();
    if (fs.existsSync(targetPath)) {
        existing = normalizeSchema(JSON.parse(fs.readFileSync(targetPath, 'utf8')));
    }
    const merged = mergeSchemas(existing, incoming);
    writeSchemaFile(targetPath, merged);
    return {
        tableCount: Object.keys(merged.columns).length,
        columnCount: Object.values(merged.columns).reduce((sum, cols) => sum + cols.length, 0)
    };
}

module.exports = {
    emptySchema,
    normalizeSchema,
    mergeSchemas,
    parseCsvSchema,
    loadSchemaFile,
    writeSchemaFile,
    importSchemaFile
};
