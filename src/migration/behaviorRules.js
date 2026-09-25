const parser = require('@babel/parser');

const RESERVED_IN_21 = new Set(['enum', 'implements', 'interface', 'let', 'package', 'private', 'protected', 'public', 'static', 'yield']);

function analyzeBehaviorRisks(text) {
    const risks = [];

    if (/\bfor\s*\(\s*each\s*\(/i.test(text)) {
        risks.push('Uses SuiteScript 2.0 "for each (... in ...)" syntax; verify behavior under 2.1.');
    }

    if (/\.toLocaleString\s*\(/.test(text)) {
        risks.push('Date/number toLocaleString formatting may differ between 2.0 and 2.1.');
    }

    if (/RESTlet/.test(text) && /\bpost\s*\(/.test(text)) {
        risks.push('RESTlet POST body/return handling may differ; retest REST consumers.');
    }

    if (/\bPromise\b/.test(text) || /\.then\s*\(/.test(text)) {
        risks.push('Server-side Promise usage should be validated under SuiteScript 2.1 runtime.');
    }

    if (/@NScriptType\s+ClientScript/i.test(text) && /=>\s*\{/.test(text)) {
        risks.push('Client scripts deployed broadly (including subrecords) may need ES5.1-compatible patterns.');
    }

    try {
        const ast = parser.parse(text, { sourceType: 'script', allowReturnOutsideFunction: true });
        const identifiers = new Set();
        walk(ast, (node) => {
            if (node.type === 'Identifier') {
                identifiers.add(node.name);
            }
        });
        for (const reserved of RESERVED_IN_21) {
            if (identifiers.has(reserved)) {
                risks.push(`Identifier "${reserved}" is reserved in SuiteScript 2.1.`);
            }
        }
    } catch {
        risks.push('File could not be parsed for AST behavior checks.');
    }

    return [...new Set(risks)];
}

function walk(node, visitor) {
    if (!node || typeof node !== 'object') {
        return;
    }
    visitor(node);
    for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) {
            value.forEach((child) => walk(child, visitor));
        } else if (value && typeof value.type === 'string') {
            walk(value, visitor);
        }
    }
}

module.exports = {
    analyzeBehaviorRisks
};
