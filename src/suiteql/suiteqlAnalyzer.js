const SUITEQL_KEYWORDS = /\b(SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|ON|AND|OR|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|UNION|DISTINCT|AS|IN|NOT|NULL|LIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END)\b/i;

function analyzeSuiteQLText(text) {
    const findings = [];
    const lines = text.split(/\r?\n/);
    const upper = text.toUpperCase();

    if (!/\bSELECT\b/i.test(text)) {
        findings.push(finding(0, 'SuiteQL query should include a SELECT statement.', 'info', 'suiteql-select'));
    }

    if (/\$\{/.test(text)) {
        findings.push(finding(
            findLine(lines, /\$\{/),
            'Avoid JavaScript template interpolation inside SuiteQL; use bound params with query.runSuiteQL({ query, params }).',
            'warning',
            'suiteql-interpolation'
        ));
    }

    if (/runSuiteQL\s*\(/.test(text) === false && !/\bFROM\b/i.test(text)) {
        return findings;
    }

    if (/\brunSuiteQL\s*\(/.test(text) && !/runSuiteQLPaged/.test(text) && /\bSELECT\b/i.test(text)) {
        findings.push(finding(
            findLine(lines, /runSuiteQL\s*\(/),
            'Non-paged runSuiteQL returns at most 5,000 rows. Use runSuiteQLPaged for larger result sets.',
            'info',
            'suiteql-row-limit'
        ));
    }

    const pageSizeMatch = text.match(/pageSize\s*:\s*(\d+)/);
    if (pageSizeMatch && Number(pageSizeMatch[1]) > 1000) {
        findings.push(finding(
            findLine(lines, /pageSize\s*:/),
            'SuiteQL pageSize maximum is 1000.',
            'warning',
            'suiteql-page-size'
        ));
    }

    if (/\?/.test(text) && !/params\s*:/.test(text)) {
        findings.push(finding(
            findLine(lines, /\?/),
            'Bound placeholders (?) should be paired with a params array in runSuiteQL.',
            'warning',
            'suiteql-params'
        ));
    }

    if (/\bORDER\s+BY\b/i.test(upper) === false && /runSuiteQLPaged/.test(text)) {
        findings.push(finding(
            findLine(lines, /runSuiteQLPaged/),
            'Paged SuiteQL queries should include ORDER BY for stable paging.',
            'info',
            'suiteql-order-by'
        ));
    }

    return findings;
}

function analyzeSuiteQLInJavaScript(text) {
    const findings = [];
    const regex = /query\.runSuiteQL(?:Paged)?\(\{[\s\S]*?query\s*:\s*`([\s\S]*?)`/g;

    for (const match of text.matchAll(regex)) {
        const queryText = match[1];
        const offset = text.indexOf(match[0]);
        const line = text.slice(0, offset).split(/\r?\n/).length - 1;
        for (const item of analyzeSuiteQLText(queryText)) {
            findings.push({ ...item, line: line + item.line });
        }
    }

    return findings;
}

function extractSuiteQLBlocks(text) {
    const blocks = [];
    const regex = /query\.runSuiteQL(?:Paged)?\(\{[\s\S]*?query\s*:\s*`([\s\S]*?)`/g;
    for (const match of text.matchAll(regex)) {
        blocks.push(match[1]);
    }
    return blocks;
}

function finding(line, message, severity, code) {
    return { line, column: 0, message, severity, code };
}

function findLine(lines, pattern) {
    const index = lines.findIndex((line) => pattern.test(line));
    return index === -1 ? 0 : index;
}

module.exports = {
    analyzeSuiteQLText,
    analyzeSuiteQLInJavaScript,
    extractSuiteQLBlocks,
    SUITEQL_KEYWORDS
};
