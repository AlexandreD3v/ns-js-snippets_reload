const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function addModuleImport(text, modulePath, alias) {
    let ast;
    try {
        ast = parser.parse(text, { sourceType: 'script', allowReturnOutsideFunction: true });
    } catch (error) {
        return { code: text, status: 'parse-error', error: error.message, alias };
    }

    let edit = null;

    traverse(ast, {
        CallExpression(callPath) {
            if (edit || callPath.node.callee?.name !== 'define' || callPath.node.arguments.length < 2) {
                return;
            }

            const arrayArg = callPath.node.arguments[0];
            const callbackArg = callPath.node.arguments[1];
            if (arrayArg.type !== 'ArrayExpression' || !isDefineCallback(callbackArg)) {
                return;
            }

            const existing = arrayArg.elements.some((element) =>
                element?.type === 'StringLiteral' && element.value === modulePath
            );
            if (existing) {
                edit = { status: 'exists' };
                callPath.stop();
                return;
            }

            const uniqueAlias = uniqueParameterName(alias, callbackArg);
            const arrayInsertion = buildArrayInsertion(text, arrayArg, modulePath);
            const paramReplacement = insertCallbackParam(text, callbackArg, uniqueAlias);
            if (!paramReplacement) {
                edit = { status: 'unsupported' };
                callPath.stop();
                return;
            }

            edit = {
                status: 'added',
                alias: uniqueAlias,
                changes: [
                    {
                        start: arrayArg.end - 1,
                        end: arrayArg.end - 1,
                        text: arrayInsertion
                    },
                    paramReplacement
                ]
            };
            callPath.stop();
        }
    });

    if (!edit) {
        return { code: text, status: 'unsupported', alias };
    }
    if (edit.status !== 'added') {
        return { code: text, status: edit.status, alias };
    }

    const changes = [...edit.changes].sort((left, right) => right.start - left.start);
    let code = text;
    for (const change of changes) {
        code = code.slice(0, change.start) + change.text + code.slice(change.end);
    }
    return { code, status: 'added', alias: edit.alias };
}

function isDefineCallback(node) {
    return node?.type === 'FunctionExpression' || node?.type === 'ArrowFunctionExpression';
}

function uniqueParameterName(alias, callbackArg) {
    const used = new Set(callbackArg.params.map(parameterName).filter(Boolean));
    if (!used.has(alias)) {
        return alias;
    }
    let suffix = 2;
    while (used.has(`${alias}${suffix}`)) {
        suffix += 1;
    }
    return `${alias}${suffix}`;
}

function parameterName(param) {
    if (!param) {
        return null;
    }
    if (param.type === 'Identifier') {
        return param.name;
    }
    if (param.type === 'AssignmentPattern' && param.left?.type === 'Identifier') {
        return param.left.name;
    }
    if (param.type === 'RestElement' && param.argument?.type === 'Identifier') {
        return param.argument.name;
    }
    return null;
}

function buildArrayInsertion(text, arrayArg, modulePath) {
    const quote = detectQuote(text, arrayArg);
    const literal = `${quote}${escapeQuoted(modulePath, quote)}${quote}`;
    if (arrayArg.elements.length === 0) {
        return literal;
    }

    const source = text.slice(arrayArg.start, arrayArg.end);
    if (source.includes('\n')) {
        return `,\n${detectIndent(source)}${literal}`;
    }
    return `, ${literal}`;
}

function detectQuote(text, arrayArg) {
    const first = arrayArg.elements.find((element) => element?.type === 'StringLiteral');
    if (!first) {
        return "'";
    }
    return text[first.start] === '"' ? '"' : "'";
}

function escapeQuoted(value, quote) {
    return String(value).replace(/\\/g, '\\\\').replace(new RegExp(quote, 'g'), `\\${quote}`);
}

function detectIndent(source) {
    const lines = source.split('\n');
    const contentLine = [...lines].reverse().find((line) => line.trim() && !line.trim().startsWith(']'));
    const match = contentLine?.match(/^(\s*)/);
    return match?.[1] || '    ';
}

function insertCallbackParam(text, callbackArg, alias) {
    if (callbackArg.params.some((param) => param.type === 'RestElement')) {
        return null;
    }

    const head = text.slice(callbackArg.start, callbackArg.body.start);
    if (callbackArg.type === 'ArrowFunctionExpression') {
        const arrowIndex = head.lastIndexOf('=>');
        if (arrowIndex < 0) {
            return null;
        }
        const prefix = head.slice(0, arrowIndex);
        const suffix = head.slice(arrowIndex);
        let newPrefix;
        if (callbackArg.params.length === 0) {
            newPrefix = prefix.replace(/\(\s*\)(\s*)$/, `(${alias})$1`);
            if (newPrefix === prefix) {
                return null;
            }
        } else if (!prefix.includes('(')) {
            const asyncLead = prefix.match(/^\s*async\s+/);
            const name = prefix.replace(/^\s*async\s+/, '').trim();
            const lead = asyncLead ? `${asyncLead[0].trimEnd()} ` : '';
            newPrefix = `${lead}(${name}, ${alias}) `;
        } else {
            const paren = prefix.lastIndexOf(')');
            if (paren < 0) {
                return null;
            }
            newPrefix = `${prefix.slice(0, paren)}, ${alias}${prefix.slice(paren)}`;
        }
        return {
            start: callbackArg.start,
            end: callbackArg.body.start,
            text: newPrefix + suffix
        };
    }

    const paren = head.lastIndexOf(')');
    if (paren < 0) {
        return null;
    }
    const insertion = callbackArg.params.length === 0 ? alias : `, ${alias}`;
    return {
        start: callbackArg.start,
        end: callbackArg.body.start,
        text: head.slice(0, paren) + insertion + head.slice(paren)
    };
}

module.exports = {
    addModuleImport
};
