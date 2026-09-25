const path = require('path');
const fs = require('fs');
const { getWorkspaceFolders, getFolderForUri } = require('./workspace');

const EMPTY_FIELDS = Object.freeze({ allFields: [], byRecordType: {} });

function getCustomFieldsConfigPath(vscode, folder) {
    const workspaceFolder = folder || getWorkspaceFolders(vscode)[0];
    if (!workspaceFolder) {
        return null;
    }

    const config = vscode.workspace.getConfiguration('netsuite', workspaceFolder.uri);
    const relativePath = config.get('customFieldsPath', '.vscode/netsuite-fields.json');
    return path.join(workspaceFolder.uri.fsPath, relativePath);
}

function loadCustomFields(vscode, folder) {
    const fieldsPath = getCustomFieldsConfigPath(vscode, folder);

    if (!fieldsPath || !fs.existsSync(fieldsPath)) {
        return { allFields: [], byRecordType: {} };
    }

    try {
        return normalizeCustomFields(JSON.parse(fs.readFileSync(fieldsPath, 'utf8')));
    } catch (error) {
        console.error('Unable to read NetSuite custom fields file.', error);
        return { allFields: [], byRecordType: {} };
    }
}

function normalizeCustomFields(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return { allFields: [], byRecordType: {} };
    }

    const byRecordType = {};
    const allFieldsSet = new Set();
    const addGroup = (recordType, fieldIds) => {
        if (!Array.isArray(fieldIds)) {
            return;
        }
        const key = recordType.toLowerCase();
        byRecordType[key] = [...new Set([...(byRecordType[key] || []), ...fieldIds])];
        fieldIds.forEach((fieldId) => allFieldsSet.add(fieldId));
    };

    if (Array.isArray(parsed.fields)) {
        parsed.fields.forEach((fieldId) => allFieldsSet.add(fieldId));
    }

    if (parsed.customFields && typeof parsed.customFields === 'object') {
        for (const [recordType, fieldIds] of Object.entries(parsed.customFields)) {
            addGroup(recordType, fieldIds);
        }
    }

    for (const [recordType, fieldIds] of Object.entries(parsed)) {
        if (recordType !== 'fields' && recordType !== 'customFields') {
            addGroup(recordType, fieldIds);
        }
    }

    return {
        allFields: [...allFieldsSet].sort(),
        byRecordType
    };
}

function mergeFieldData(base, extraIds) {
    return {
        allFields: [...new Set([...base.allFields, ...extraIds])].sort(),
        byRecordType: base.byRecordType
    };
}

function createCustomFieldStore(vscode, options = {}) {
    const cache = new Map();
    const discoverIds = options.discoverIds || (() => []);

    const loadFolder = (folder) => {
        const configured = loadCustomFields(vscode, folder);
        const config = vscode.workspace.getConfiguration('netsuite', folder.uri);
        const discovered = config.get('sdfFieldDiscovery', true) ? discoverIds(folder.uri.fsPath) : [];
        const data = mergeFieldData(configured, discovered);
        cache.set(folder.uri.fsPath, data);
        return data;
    };

    return {
        get(uri) {
            const folder = getFolderForUri(vscode, uri) || getWorkspaceFolders(vscode)[0];
            if (!folder) {
                return EMPTY_FIELDS;
            }
            return cache.get(folder.uri.fsPath) || loadFolder(folder);
        },
        reload() {
            cache.clear();
            return getWorkspaceFolders(vscode).map((folder) => ({
                folder,
                path: getCustomFieldsConfigPath(vscode, folder),
                count: loadFolder(folder).allFields.length
            }));
        }
    };
}

function detectRecordContext(documentText) {
    const match = documentText.match(/record\.(?:load|create|copy|transform)\(\{[\s\S]*?type:\s*(?:record\.Type\.)?['"]?([A-Za-z_]+)/);
    return match ? match[1].toLowerCase().replace(/_/g, '') : null;
}

function shouldSuggestFieldId(linePrefix) {
    return /(?:fieldId|sublistFieldId|name):\s*['"][\w]*$/.test(linePrefix);
}

function getFieldSuggestions(linePrefix, documentText, customFieldData) {
    const prefixMatch = linePrefix.match(/(?:fieldId|sublistFieldId|name):\s*['"]([\w]*)$/);
    if (!prefixMatch) {
        return [];
    }

    const typedPrefix = prefixMatch[1].toLowerCase();
    const recordContext = detectRecordContext(documentText);
    const scopedGroup = recordContext && Object.entries(customFieldData.byRecordType)
        .find(([recordType]) => recordType.replace(/_/g, '') === recordContext);
    const candidates = scopedGroup ? scopedGroup[1] : customFieldData.allFields;

    return candidates.filter((fieldId) => fieldId.toLowerCase().startsWith(typedPrefix));
}

module.exports = {
    getCustomFieldsConfigPath,
    loadCustomFields,
    normalizeCustomFields,
    mergeFieldData,
    createCustomFieldStore,
    shouldSuggestFieldId,
    getFieldSuggestions,
    detectRecordContext
};
