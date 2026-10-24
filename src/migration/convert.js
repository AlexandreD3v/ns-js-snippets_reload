const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { auditText } = require('./audit');

const IGNORED_FILE_NAMES = new Set([
    'suitecloud.config.js',
    'jest.config.js',
    'babel.config.js',
    'webpack.config.js',
    'rollup.config.js',
    'gulpfile.js',
    'gruntfile.js',
    'eslint.config.js'
]);

function looksLikeSuiteScript(content) {
    return /@N(ApiVersion|ScriptType|ModuleScope)\b/.test(content) || /\bdefine\s*\(/.test(content);
}

function isSuiteScriptFile(filePath, content) {
    const base = path.basename(filePath).toLowerCase();
    if (IGNORED_FILE_NAMES.has(base) || /\.(test|spec)\.js$/i.test(base)) {
        return false;
    }
    if (/(^|[\\/])(node_modules|dist|coverage)([\\/]|$)/.test(filePath)) {
        return false;
    }
    return looksLikeSuiteScript(content);
}

function convertTo21(text) {
    const audit = auditText(text);
    if (!looksLikeSuiteScript(text)) {
        return { output: text, audit, changed: false };
    }

    let output = normalizeHeader(text);
    output = convertFunctionProperties(output, audit);
    return { output, audit, changed: output !== text };
}

function convertFunctionProperties(text, audit) {
    let ast;
    try {
        ast = parser.parse(text, {
            sourceType: 'script',
            allowReturnOutsideFunction: true
        });
    } catch (error) {
        audit.manualReview.push(`AST conversion skipped: ${error.message}`);
        return text;
    }

    const replacements = [];
    traverse(ast, {
        Property(propertyPath) {
            if (propertyPath.parent.type !== 'ObjectExpression') {
                return;
            }
            if (propertyPath.node.kind && propertyPath.node.kind !== 'init') {
                return;
            }

            const fn = propertyPath.node.value;
            if (!fn || fn.type !== 'FunctionExpression') {
                return;
            }
            if (fn.generator || fn.async) {
                audit.manualReview.push('Skipped arrow conversion for an async or generator function property.');
                return;
            }
            if (functionUsesThisOrArguments(fn)) {
                audit.manualReview.push('Skipped arrow conversion because the function uses this or arguments.');
                return;
            }

            const replacement = toArrowHead(text, fn);
            if (!replacement) {
                audit.manualReview.push('Skipped arrow conversion because the function header could not be rewritten safely.');
                return;
            }

            replacements.push(replacement);
            audit.info.push('Modernized an object function property to an arrow function.');
        }
    });

    replacements.sort((left, right) => right.start - left.start);
    let output = text;
    for (const replacement of replacements) {
        output = output.slice(0, replacement.start) + replacement.text + output.slice(replacement.end);
    }
    return output;
}

function toArrowHead(text, fn) {
    const head = text.slice(fn.start, fn.body.start);
    if (!/^function\b/.test(head)) {
        return null;
    }

    const open = head.indexOf('(');
    const close = head.lastIndexOf(')');
    if (open < 0 || close < open) {
        return null;
    }

    const params = head.slice(open, close + 1);
    const afterParams = head.slice(close + 1);
    const gap = afterParams.length === 0 ? ' ' : afterParams;
    return {
        start: fn.start,
        end: fn.body.start,
        text: `${params} =>${gap}`
    };
}

function functionUsesThisOrArguments(fnNode) {
    let found = false;

    const walk = (node, isRoot) => {
        if (!node || found || typeof node !== 'object') {
            return;
        }
        if (!isRoot && isNestedFunction(node)) {
            return;
        }
        if (node.type === 'ThisExpression' || (node.type === 'Identifier' && node.name === 'arguments')) {
            found = true;
            return;
        }

        for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') {
                continue;
            }
            const value = node[key];
            if (Array.isArray(value)) {
                for (const child of value) {
                    if (child && typeof child.type === 'string') {
                        walk(child, false);
                    }
                }
            } else if (value && typeof value.type === 'string') {
                walk(value, false);
            }
        }
    };

    walk(fnNode.body, true);
    return found;
}

function isNestedFunction(node) {
    return node.type === 'FunctionExpression'
        || node.type === 'FunctionDeclaration'
        || node.type === 'ArrowFunctionExpression'
        || node.type === 'ObjectMethod'
        || node.type === 'ClassMethod';
}

function normalizeHeader(text) {
    if (/@NApiVersion\s+2\.(?:0|x)/i.test(text)) {
        return text.replace(/@NApiVersion\s+2\.(?:0|x)/gi, '@NApiVersion 2.1');
    }
    if (/@NApiVersion\s+2\.1/i.test(text)) {
        return text;
    }
    if (/\bdefine\s*\(/.test(text)) {
        const newline = text.includes('\r\n') ? '\r\n' : '\n';
        return `/**${newline} * @NApiVersion 2.1${newline} */${newline}${text}`;
    }
    return text;
}

module.exports = {
    convertTo21,
    normalizeHeader,
    looksLikeSuiteScript,
    isSuiteScriptFile
};
