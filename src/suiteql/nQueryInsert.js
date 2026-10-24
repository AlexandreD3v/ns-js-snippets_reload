function escapeQueryForJsTemplate(queryText) {
    return String(queryText)
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$\{/g, '\\${');
}

function escapeSnippetText(value) {
    return String(value).replace(/\$|}|\\/g, '\\$&');
}

function buildNQuerySnippet(queryText) {
    const body = escapeQueryForJsTemplate(queryText)
        .split('\n')
        .map((line) => `        ${line}`)
        .join('\n');

    return [
        'const results = query.runSuiteQL({',
        '    query: `',
        escapeSnippetText(body),
        '    `,',
        '    params: [$1]',
        '}).asMappedResults();',
        '$0'
    ].join('\n');
}

function chooseNQueryTarget(editors, activeIndex) {
    const active = editors[activeIndex];
    if (!active) {
        return { type: 'none' };
    }
    if (active.languageId === 'javascript') {
        return { type: 'active' };
    }
    if (active.languageId === 'suiteql' || active.languageId === 'sql') {
        const jsIndex = editors.findIndex((editor, index) => index !== activeIndex && editor.languageId === 'javascript');
        if (jsIndex >= 0) {
            return { type: 'existing', index: jsIndex };
        }
        return { type: 'untitled' };
    }
    return { type: 'unsupported' };
}

module.exports = {
    escapeQueryForJsTemplate,
    escapeSnippetText,
    buildNQuerySnippet,
    chooseNQueryTarget
};
