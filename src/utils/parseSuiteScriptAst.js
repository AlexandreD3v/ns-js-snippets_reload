const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function parseSuiteScriptAst(text) {
    try {
        return parser.parse(text, {
            sourceType: 'script',
            allowReturnOutsideFunction: true
        });
    } catch {
        return null;
    }
}

function isDefineCall(node) {
    return (
        node &&
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'define'
    );
}

function getDefineCallback(defineCall) {
    if (!defineCall || defineCall.arguments.length < 2) {
        return null;
    }
    const callback = defineCall.arguments[1];
    if (callback.type === 'FunctionExpression' || callback.type === 'ArrowFunctionExpression') {
        return callback;
    }
    return null;
}

function findDefineCall(ast) {
    let found = null;
    traverse(ast, {
        CallExpression(path) {
            if (found || !isDefineCall(path.node)) {
                return;
            }
            found = path.node;
            path.stop();
        }
    });
    return found;
}

function detectImportedModulesFromAst(text) {
    const ast = parseSuiteScriptAst(text);
    if (!ast) {
        return null;
    }

    const defineCall = findDefineCall(ast);
    if (!defineCall || !defineCall.arguments[0] || defineCall.arguments[0].type !== 'ArrayExpression') {
        return [];
    }

    const modulePaths = defineCall.arguments[0].elements
        .filter((element) => element && element.type === 'StringLiteral')
        .map((element) => element.value);

    const callback = getDefineCallback(defineCall);
    let aliases = [];
    if (callback) {
        if (callback.type === 'FunctionExpression') {
            aliases = callback.params.map((param) => (param.type === 'Identifier' ? param.name : '')).filter(Boolean);
        } else if (callback.type === 'ArrowFunctionExpression' && callback.params.length > 0) {
            const first = callback.params[0];
            if (first.type === 'Identifier') {
                aliases = [first.name];
            }
        }
    }

    return modulePaths.map((modulePath, index) => ({
        path: modulePath,
        alias: aliases[index] || modulePath.split('/').pop()
    }));
}

function collectEntryPointKeys(objectExpression, exported) {
    if (!objectExpression || objectExpression.type !== 'ObjectExpression') {
        return;
    }

    for (const property of objectExpression.properties) {
        if (property.type !== 'ObjectProperty' && property.type !== 'Property') {
            continue;
        }
        if (property.key.type === 'Identifier') {
            exported.add(property.key.name);
        } else if (property.key.type === 'StringLiteral') {
            exported.add(property.key.value);
        }
    }
}

function getExportedEntryPointsFromAst(text) {
    const ast = parseSuiteScriptAst(text);
    if (!ast) {
        return null;
    }

    const defineCall = findDefineCall(ast);
    const callback = getDefineCallback(defineCall);
    if (!callback) {
        return new Set();
    }

    const exported = new Set();
    const callbackBody = callback.body;
    if (!callbackBody) {
        return exported;
    }

    if (callbackBody.type === 'ObjectExpression') {
        collectEntryPointKeys(callbackBody, exported);
        return exported;
    }

    if (callbackBody.type === 'BlockStatement') {
        for (const statement of callbackBody.body) {
            if (statement.type === 'ReturnStatement') {
                collectEntryPointKeys(statement.argument, exported);
            }
        }
    }

    return exported;
}

module.exports = {
    parseSuiteScriptAst,
    detectImportedModulesFromAst,
    getExportedEntryPointsFromAst
};
