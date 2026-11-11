const switchedSqlFiles = new Set();

function isSqlFileName(fileName) {
    return typeof fileName === 'string' && fileName.toLowerCase().endsWith('.sql');
}

function sqlAssociationEnabled(vscode, document) {
    const resource = document && document.uri;
    return vscode.workspace.getConfiguration('netsuite', resource).get('suiteqlAssociateSqlFiles', false) === true;
}

function documentKey(document) {
    return document && document.uri ? document.uri.toString() : '';
}

async function applySqlAssociation(vscode, document) {
    if (!document || !document.uri || document.uri.scheme !== 'file' || !isSqlFileName(document.fileName)) {
        return;
    }

    const key = documentKey(document);
    if (sqlAssociationEnabled(vscode, document)) {
        if (document.languageId !== 'suiteql') {
            switchedSqlFiles.add(key);
            await vscode.languages.setTextDocumentLanguage(document, 'suiteql');
        }
        return;
    }

    if (switchedSqlFiles.has(key) && document.languageId === 'suiteql') {
        try {
            await vscode.languages.setTextDocumentLanguage(document, 'sql');
        } catch {
            await vscode.languages.setTextDocumentLanguage(document, 'plaintext');
        }
        switchedSqlFiles.delete(key);
    }
}

function watchSqlFileAssociation(vscode, context) {
    const applyAll = () => {
        for (const document of vscode.workspace.textDocuments || []) {
            applySqlAssociation(vscode, document);
        }
    };

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            applySqlAssociation(vscode, document);
        }),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('netsuite.suiteqlAssociateSqlFiles')) {
                applyAll();
            }
        })
    );
    applyAll();
}

module.exports = {
    isSqlFileName,
    sqlAssociationEnabled,
    applySqlAssociation,
    watchSqlFileAssociation
};
