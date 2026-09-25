const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const { auditText } = require('./audit');

function convertTo21(text) {
    const audit = auditText(text);
    let output = normalizeHeader(text);

    try {
        const ast = parser.parse(output, {
            sourceType: 'script',
            allowReturnOutsideFunction: true
        });

        traverse(ast, {
            ReturnStatement(path) {
                const argument = path.node.argument;
                if (!argument || argument.type !== 'ObjectExpression') {
                    return;
                }

                for (const property of argument.properties) {
                    if (property.type !== 'ObjectProperty' && property.type !== 'Property') {
                        continue;
                    }
                    const value = property.value;
                    if (!value || value.type !== 'FunctionExpression' || value.generator || value.async) {
                        continue;
                    }

                    property.value = {
                        type: 'ArrowFunctionExpression',
                        params: value.params,
                        body: value.body,
                        expression: false
                    };
                    audit.info.push('Modernized an exported entry point to an arrow function.');
                }
            }
        });

        output = generate(ast, { retainLines: true }).code;
    } catch (error) {
        audit.manualReview.push(`AST conversion skipped: ${error.message}`);
    }

    output = normalizeHeader(output);
    return { output, audit, changed: output !== text };
}

function normalizeHeader(text) {
    if (/@NApiVersion\s+2\.(?:0|x)/i.test(text)) {
        return text.replace(/@NApiVersion\s+2\.(?:0|x)/gi, '@NApiVersion 2.1');
    }
    if (/@NApiVersion\s+2\.1/i.test(text)) {
        return text;
    }
    if (/\bdefine\s*\(/.test(text)) {
        return `/**\n * @NApiVersion 2.1\n */\n${text}`;
    }
    return text;
}

module.exports = {
    convertTo21,
    normalizeHeader
};
