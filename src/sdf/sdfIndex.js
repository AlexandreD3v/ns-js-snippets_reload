const path = require('path');
const fs = require('fs');
const { listFiles } = require('../utils/workspace');

const cache = new Map();

function buildIndex(projectRoot) {
    const info = getProjectPaths(projectRoot);
    if (!info) {
        return emptyIndex();
    }

    const cacheKey = projectRoot;
    const statKey = `${info.objectsPath}:${mtime(info.objectsPath)}:${mtime(info.fileCabinetPath)}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.statKey === statKey) {
        return cached.index;
    }

    const index = emptyIndex();
    index.projectRoot = projectRoot;
    index.projectInfo = info;

    if (fs.existsSync(info.objectsPath)) {
        for (const filePath of listFiles(info.objectsPath, (p) => p.endsWith('.xml'))) {
            ingestObjectXml(index, filePath, info);
        }
    }

    if (fs.existsSync(info.fileCabinetPath)) {
        for (const filePath of listFiles(info.fileCabinetPath, (p) => p.endsWith('.js'))) {
            index.scriptFiles.push({
                path: filePath,
                relativePath: path.relative(info.projectFolder, filePath).replace(/\\/g, '/')
            });
        }
    }

    cache.set(cacheKey, { statKey, index });
    return index;
}

function emptyIndex() {
    return {
        projectRoot: null,
        projectInfo: null,
        scriptObjects: [],
        scriptFiles: [],
        fieldIds: [],
        scriptIds: [],
        deployPaths: [],
        fieldDefinitions: []
    };
}

function getProjectPaths(projectRoot) {
    const { getProjectInfo } = require('../services/suitecloudRunner');
    try {
        return getProjectInfo(projectRoot);
    } catch {
        return null;
    }
}

function mtime(targetPath) {
    try {
        return fs.statSync(targetPath).mtimeMs;
    } catch {
        return 0;
    }
}

function resolveScriptFilePath(projectFolder, fileCabinetPath, scriptFile) {
    const normalized = String(scriptFile).replace(/\\/g, '/').replace(/^\/+/, '');
    const segments = normalized.split('/').filter(Boolean);
    if (/^filecabinet$/i.test(segments[0] || '')) {
        return path.join(projectFolder, ...segments);
    }
    return path.join(fileCabinetPath, ...segments);
}

function ingestObjectXml(index, filePath, info) {
    const xml = fs.readFileSync(filePath, 'utf8');
    const scriptIdMatch = xml.match(/<scriptid>([^<]+)<\/scriptid>/i);
    const scriptIdAttribute = xml.match(/\bscriptid\s*=\s*["']([^"']+)["']/i);
    const scriptFileMatch = xml.match(/<scriptfile>\[([^\]]+)\]<\/scriptfile>/i);
    const scriptId = scriptIdMatch ? scriptIdMatch[1].trim() : null;
    const scriptFile = scriptFileMatch ? scriptFileMatch[1].trim() : null;
    const primaryId = (scriptIdAttribute?.[1] || scriptId || '').trim().toLowerCase();

    if (scriptId) {
        index.scriptIds.push(scriptId);
    }

    if (scriptFile) {
        index.scriptObjects.push({
            scriptId,
            scriptFile,
            objectPath: filePath,
            scriptPath: resolveScriptFilePath(info.projectFolder, info.fileCabinetPath, scriptFile)
        });
    }

    if (/^cust[a-z0-9_]+$/i.test(primaryId)) {
        index.fieldDefinitions.push({
            id: primaryId,
            objectPath: filePath,
            exact: true
        });
    }

    for (const match of xml.matchAll(/\b(cust(?:body|entity|item|record|column|script|page|form|center|email|tmpl|import|dataset|collection)[a-z0-9_]+)\b/gi)) {
        const id = match[1].toLowerCase();
        index.fieldIds.push(id);
        index.fieldDefinitions.push({
            id,
            objectPath: filePath,
            exact: id === primaryId
        });
    }

    index.fieldIds = [...new Set(index.fieldIds)].sort();
}

function findFieldDefinitionFiles(index, fieldId) {
    const id = String(fieldId || '').toLowerCase();
    const matches = (index.fieldDefinitions || []).filter((item) => item.id === id);
    const exact = matches.filter((item) => item.exact);
    const chosen = exact.length > 0 ? exact : matches;
    const seen = new Set();
    return chosen.filter((item) => {
        if (seen.has(item.objectPath)) {
            return false;
        }
        seen.add(item.objectPath);
        return true;
    });
}

function discoverFieldIds(projectRoot) {
    return buildIndex(projectRoot).fieldIds;
}

function findScriptObjectForFile(index, filePath) {
    const normalized = path.resolve(filePath);
    return index.scriptObjects.find((item) => path.resolve(item.scriptPath) === normalized);
}

function parseDeployXml(deployPath) {
    if (!deployPath || !fs.existsSync(deployPath)) {
        return [];
    }

    const xml = fs.readFileSync(deployPath, 'utf8');
    return [...xml.matchAll(/<path>([^<]+)<\/path>/gi)].map((match) => match[1].trim());
}

module.exports = {
    buildIndex,
    discoverFieldIds,
    findScriptObjectForFile,
    findFieldDefinitionFiles,
    resolveScriptFilePath,
    parseDeployXml
};
