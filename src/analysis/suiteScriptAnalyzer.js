const {
    detectScriptType,
    hasDefine,
    hasNApiVersion,
    getApiVersion,
    getWrongEntryPointsForScriptType,
    getUnexportedEntryPoints,
    getExportedEntryPoints
} = require('../utils/parseSuiteScript');

function analyzeText(text, data) {
    const findings = [];
    const lines = text.split(/\r?\n/);

    if (!hasDefine(text) && !/@NScriptType/i.test(text)) {
        return findings;
    }

    if (hasDefine(text) && !hasNApiVersion(text)) {
        findings.push(finding(0, 'Missing @NApiVersion annotation.', 'warning', 'missing-api-version'));
    }

    const scriptType = detectScriptType(text);

    if (hasDefine(text) && !scriptType) {
        findings.push(finding(0, 'SuiteScript file should include an @NScriptType annotation.', 'warning', 'missing-script-type'));
    }

    if (hasDefine(text) && !/return\s*\{/.test(text)) {
        findings.push(finding(
            findLine(lines, /\bdefine\s*\(/),
            'AMD module should return an object with entry points: return { ... }.',
            'warning',
            'missing-return-object'
        ));
    }

    const apiVersion = getApiVersion(text);
    if (apiVersion && apiVersion.startsWith('2.0') && /=>\s*\{/.test(text)) {
        findings.push(finding(
            findLine(lines, /=>\s*\{/),
            'Arrow functions require @NApiVersion 2.1 or later.',
            'info',
            'arrow-requires-21'
        ));
    }

    if (scriptType && data.entryPoints[scriptType]) {
        const reported = new Set();

        for (const name of getWrongEntryPointsForScriptType(text, scriptType, data.entryPoints)) {
            reported.add(name);
            findings.push(finding(
                findLine(lines, new RegExp(`\\b${name}\\b`)),
                `'${name}' is not a valid entry point for @NScriptType ${scriptType}.`,
                'warning',
                'wrong-entry-point'
            ));
        }

        for (const name of getUnexportedEntryPoints(text, scriptType, data.entryPoints)) {
            findings.push(finding(
                findLine(lines, new RegExp(`\\bfunction\\s+${name}\\s*\\(`)),
                `'${name}' is defined but not exported in the return object.`,
                'warning',
                'unexported-entry-point'
            ));
        }

        const expected = new Set(data.entryPoints[scriptType].map((entryPoint) => entryPoint.label));
        const known = new Set(Object.values(data.entryPoints).flat().map((entryPoint) => entryPoint.label));
        for (const name of getExportedEntryPoints(text)) {
            if (known.has(name) && !expected.has(name) && !reported.has(name)) {
                findings.push(finding(
                    findLine(lines, new RegExp(`${name}\\s*:`)),
                    `'${name}' is exported but is not valid for @NScriptType ${scriptType}.`,
                    'warning',
                    'invalid-export'
                ));
            }
        }
    }

    return findings;
}

function finding(line, message, severity, code) {
    return { line, column: 0, message, severity, code };
}

function findLine(lines, pattern) {
    const index = lines.findIndex((line) => pattern.test(line));
    return index === -1 ? 0 : index;
}

module.exports = {
    analyzeText,
    findLine
};
