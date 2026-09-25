const parser = require('@babel/parser');

function analyzeGovernance(text, governanceMap = {}) {
    const findings = [];
    let ast;

    try {
        ast = parser.parse(text, {
            sourceType: 'script',
            allowReturnOutsideFunction: true,
            plugins: ['jsx']
        });
    } catch {
        return { findings, estimatedUnits: 0 };
    }

    const loopRanges = [];
    const visitLoop = (node) => {
        if (!node || typeof node !== 'object') {
            return;
        }
        if (node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement' ||
            node.type === 'WhileStatement' || node.type === 'DoWhileStatement') {
            loopRanges.push({ start: node.start, end: node.end });
        }
        for (const key of Object.keys(node)) {
            const value = node[key];
            if (Array.isArray(value)) {
                value.forEach(visitLoop);
            } else if (value && typeof value.type === 'string') {
                visitLoop(value);
            }
        }
    };
    visitLoop(ast);

    let estimatedUnits = 0;
    const expensiveCalls = Object.keys(governanceMap);

    const visitCalls = (node) => {
        if (!node || typeof node !== 'object') {
            return;
        }

        if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression') {
            const key = memberChain(node.callee);
            const cost = governanceMap[key];
            if (cost) {
                estimatedUnits += cost;
                if (loopRanges.some((range) => node.start >= range.start && node.end <= range.end)) {
                    const line = lineFromOffset(text, node.start);
                    findings.push({
                        line,
                        column: 0,
                        message: `${key} inside a loop may consume governance quickly (~${cost} units per call).`,
                        severity: 'info',
                        code: 'governance-loop'
                    });
                }
            }
        }

        for (const key of Object.keys(node)) {
            const value = node[key];
            if (Array.isArray(value)) {
                value.forEach(visitCalls);
            } else if (value && typeof value.type === 'string') {
                visitCalls(value);
            }
        }
    };
    visitCalls(ast);

    if (/\.run\(\)\.each\(/.test(text) && !/getRemainingUsage/.test(text)) {
        findings.push({
            line: lineFromOffset(text, text.indexOf('.run().each(')),
            column: 0,
            message: 'Search each() loops should check runtime.getCurrentScript().getRemainingUsage() in long-running scripts.',
            severity: 'info',
            code: 'governance-search-each'
        });
    }

    return { findings, estimatedUnits };
}

function memberChain(node) {
    if (node.object?.type === 'Identifier' && node.property?.type === 'Identifier') {
        return `${node.object.name}.${node.property.name}`;
    }
    if (node.object?.type === 'MemberExpression' && node.property?.type === 'Identifier') {
        return `${memberChain(node.object)}.${node.property.name}`;
    }
    return '';
}

function lineFromOffset(text, offset) {
    return text.slice(0, offset).split(/\r?\n/).length - 1;
}

module.exports = {
    analyzeGovernance
};
