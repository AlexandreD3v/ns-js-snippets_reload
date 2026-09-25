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
            Property(path) {
                const node = path.node;
                if (!node.value || node.value.type !== 'FunctionExpression' || node.value.generator || node.value.async) {
                    return;
                }

                path.node.value = {
                    type: 'ArrowFunctionExpression',
                    params: node.value.params,
                    body: node.value.body,
                    expression: false
                };
                audit.info.push('Modernized an exported function property to an arrow function.');
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
