const SCRIPT_TYPE_ALIASES = {
    clientscript: 'clientscript',
    usereventscript: 'usereventscript',
    suitelet: 'suitelet',
    restlet: 'restlet',
    mapreducescript: 'mapreducescript',
    scheduledscript: 'scheduledscript',
    massupdatescript: 'massupdatescript',
    portlet: 'portlet',
    workflowactionscript: 'workflowactionscript',
    bundleinstallationscript: 'bundleinstallationscript'
};

function detectScriptType(documentText) {
    const match = documentText.match(/@NScriptType\s+([A-Za-z]+)/i);
    if (!match) {
        return null;
    }

    const normalized = match[1].toLowerCase();
    return SCRIPT_TYPE_ALIASES[normalized] || normalized;
}

function hasDefine(documentText) {
    return /\bdefine\s*\(/.test(documentText);
}

function hasNApiVersion(documentText) {
    return /@NApiVersion\s+[\d.x]+/i.test(documentText);
}

function getApiVersion(documentText) {
    const match = documentText.match(/@NApiVersion\s+([\d.x]+)/i);
    return match ? match[1] : null;
}

function detectImportedModules(documentText) {
    const defineMatch = documentText.match(/define\s*\(\s*\[([\s\S]*?)\]\s*,\s*function\s*\(([\s\S]*?)\)/);
    if (!defineMatch) {
        return [];
    }

    const modulePaths = [...defineMatch[1].matchAll(/['"](N\/[^'"]+)['"]/g)].map((match) => match[1]);
    const aliases = defineMatch[2]
        .split(',')
        .map((alias) => alias.trim())
        .filter(Boolean);

    return modulePaths.map((modulePath, index) => ({
        path: modulePath,
        alias: aliases[index] || modulePath.split('/').pop()
    }));
}

function getDefinedFunctions(documentText) {
    const functions = new Set();

    for (const match of documentText.matchAll(/\bfunction\s+([A-Za-z_]\w*)\s*\(/g)) {
        functions.add(match[1]);
    }

    for (const match of documentText.matchAll(/\bconst\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?(?:function|\()/g)) {
        functions.add(match[1]);
    }

    return [...functions];
}

function getExportedEntryPoints(documentText) {
    const exported = new Set();
    const returnMatch = documentText.match(/return\s*\{([\s\S]*?)\n\s*\}\s*;?\s*\}\s*\)\s*;?/);

    if (!returnMatch) {
        return exported;
    }

    const returnBody = returnMatch[1];

    for (const match of returnBody.matchAll(/([A-Za-z_]\w*)\s*:/g)) {
        exported.add(match[1]);
    }

    return exported;
}

function getWrongEntryPointsForScriptType(documentText, scriptType, entryPointsByType) {
    if (!scriptType || !entryPointsByType[scriptType]) {
        return [];
    }

    const validLabels = new Set(entryPointsByType[scriptType].map((entryPoint) => entryPoint.label));
    const allScriptEntryPoints = new Set(
        Object.values(entryPointsByType).flat().map((entryPoint) => entryPoint.label)
    );

    const wrong = [];

    for (const functionName of getDefinedFunctions(documentText)) {
        if (allScriptEntryPoints.has(functionName) && !validLabels.has(functionName)) {
            wrong.push(functionName);
        }
    }

    for (const exportedName of getExportedEntryPoints(documentText)) {
        if (allScriptEntryPoints.has(exportedName) && !validLabels.has(exportedName)) {
            wrong.push(exportedName);
        }
    }

    return [...new Set(wrong)];
}

function getUnexportedEntryPoints(documentText, scriptType, entryPointsByType) {
    if (!scriptType || !entryPointsByType[scriptType]) {
        return [];
    }

    const definedFunctions = new Set(getDefinedFunctions(documentText));
    const exported = getExportedEntryPoints(documentText);
    const validLabels = entryPointsByType[scriptType].map((entryPoint) => entryPoint.label);

    return validLabels.filter((label) => definedFunctions.has(label) && !exported.has(label));
}

function detectDotContext(linePrefix, importedModules) {
    const match = linePrefix.match(/(\w+)\.([\w.]*)$/);
    if (!match) {
        return null;
    }

    const alias = match[1];
    const propertyPath = match[2];
    const importedModule = importedModules.find((module) => module.alias === alias);

    if (!importedModule) {
        return null;
    }

    return {
        alias,
        modulePath: importedModule.path,
        propertyPath
    };
}

function buildEntryPointSnippet(entryPoint) {
    if (entryPoint.snippet) {
        return entryPoint.snippet;
    }

    const parameterSection = entryPoint.parameterName || '';

    if (entryPoint.validator) {
        return `function ${entryPoint.label}(${parameterSection}) {\n\t$0\n\treturn true;\n}`;
    }

    return `function ${entryPoint.label}(${parameterSection}) {\n\t$0\n}`;
}

module.exports = {
    detectScriptType,
    hasDefine,
    hasNApiVersion,
    getApiVersion,
    detectImportedModules,
    getDefinedFunctions,
    getExportedEntryPoints,
    getWrongEntryPointsForScriptType,
    getUnexportedEntryPoints,
    detectDotContext,
    buildEntryPointSnippet
};
