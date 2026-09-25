const { loadSchema, getTableNames, getColumnsForTable } = require('../suiteql/schema');
const { SUITEQL_KEYWORDS } = require('../suiteql/suiteqlAnalyzer');

function createSuiteQLCompletionProvider(vscode, data) {
    return vscode.languages.registerCompletionItemProvider(
        [{ language: 'suiteql' }, { language: 'javascript' }],
        {
            provideCompletionItems(document, position) {
                const linePrefix = document.lineAt(position).text.slice(0, position.character);
                const suggestions = [];

                if (document.languageId === 'suiteql' || /\b(FROM|JOIN)\s+[\w.]*$/i.test(linePrefix)) {
                    const schema = loadSchema(vscode, document.uri);
                    const tables = getTableNames(schema, data.suiteqlTables);
                    suggestions.push(...tables.map((table) => {
                        const item = new vscode.CompletionItem(table, vscode.CompletionItemKind.Struct);
                        item.detail = 'SuiteQL table';
                        item.sortText = `9_${table}`;
                        return item;
                    }));
                }

                if (document.languageId === 'suiteql' && /\bSELECT\s+[\w.,\s]*$/i.test(linePrefix)) {
                    const schema = loadSchema(vscode, document.uri);
                    const fromMatch = document.getText().match(/\bFROM\s+([A-Za-z0-9_]+)/i);
                    if (fromMatch) {
                        for (const column of getColumnsForTable(schema, fromMatch[1])) {
                            const item = new vscode.CompletionItem(column, vscode.CompletionItemKind.Field);
                            item.detail = `${fromMatch[1]} column`;
                            suggestions.push(item);
                        }
                    }
                }

                if (document.languageId === 'suiteql' && /\b[\w]*$/i.test(linePrefix)) {
                    const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'ON', 'AND', 'OR', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'DISTINCT', 'AS'];
                    for (const keyword of keywords) {
                        if (keyword.toLowerCase().startsWith(linePrefix.trim().toLowerCase())) {
                            suggestions.push(new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword));
                        }
                    }
                }

                if (SUITEQL_KEYWORDS.test(linePrefix) === false && /query\.$/.test(linePrefix)) {
                    suggestions.push(new vscode.CompletionItem('runSuiteQL', vscode.CompletionItemKind.Method));
                    suggestions.push(new vscode.CompletionItem('runSuiteQLPaged', vscode.CompletionItemKind.Method));
                }

                return suggestions;
            }
        },
        '.',
        ' ',
        '\t'
    );
}

module.exports = {
    createSuiteQLCompletionProvider
};
