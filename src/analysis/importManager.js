const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

function addModuleImport(text, modulePath, alias) {
    const ast = parser.parse(text, { sourceType: 'script', allowReturnOutsideFunction: true });
    let updated = false;

    traverse(ast, {
        CallExpression(path) {
            if (updated || path.node.callee?.name !== 'define' || path.node.arguments.length < 2) {
                return;
            }

            const arrayArg = path.node.arguments[0];
            const callbackArg = path.node.arguments[1];
            if (arrayArg.type !== 'ArrayExpression' || callbackArg.type !== 'FunctionExpression') {
                return;
            }

            const existing = arrayArg.elements.some((element) =>
                element?.type === 'StringLiteral' && element.value === modulePath
            );
            if (existing) {
                return;
            }

            arrayArg.elements.push({ type: 'StringLiteral', value: modulePath });
            callbackArg.params.push({ type: 'Identifier', name: alias });
            updated = true;
            path.stop();
        }
    });

    return updated ? generate(ast, { retainLines: true }).code : text;
}

module.exports = {
    addModuleImport
};
