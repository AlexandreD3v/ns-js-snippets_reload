const {
    detectScriptType,
    detectImportedModules,
    detectDotContext,
    buildEntryPointSnippet
} = require('../utils/parseSuiteScript');

function createCompletionProvider(vscode, data) {
    return vscode.languages.registerCompletionItemProvider(
        { language: 'javascript' },
        {
            provideCompletionItems(document, position) {
                const suggestions = [];
                const linePrefix = document.lineAt(position).text.slice(0, position.character);
                const documentText = document.getText();
                const detectedScriptType = detectScriptType(documentText);
                const importedModules = detectImportedModules(documentText);

                if (shouldSuggestModules(linePrefix)) {
                    suggestions.push(...createModuleItems(vscode, data.modules));
                }

                if (shouldSuggestAnnotations(linePrefix)) {
                    suggestions.push(...createAnnotationItems(vscode, data.annotations));
                }

                if (detectedScriptType && shouldSuggestEntryPoints(linePrefix)) {
                    suggestions.push(...createEntryPointItems(vscode, detectedScriptType, documentText, data.entryPoints));
                }

                const dotContext = detectDotContext(linePrefix, importedModules);
                if (dotContext) {
                    suggestions.push(...createEnumItems(vscode, dotContext, data.enums));
                }

                return suggestions;
            }
        },
        '/',
        '@',
        '.',
        "'",
        '"'
    );
}

function shouldSuggestModules(linePrefix) {
    return /define\s*\(\s*\[[^\]]*$/.test(linePrefix) ||
        /['"]N\/[\w/]*$/.test(linePrefix) ||
        /\bN\/[\w/]*$/.test(linePrefix);
}

function shouldSuggestAnnotations(linePrefix) {
    return /\/\*\*?$/.test(linePrefix) ||
        /^\s*\*\s*@?[A-Za-z]*$/.test(linePrefix) ||
        /^\s*@[A-Za-z]*$/.test(linePrefix);
}

function shouldSuggestEntryPoints(linePrefix) {
    return /^\s*$/.test(linePrefix) ||
        /^\s*(function\s+)?[A-Za-z_]*$/.test(linePrefix);
}

function createModuleItems(vscode, modules) {
    return modules.map((moduleSuggestion) => {
        const item = new vscode.CompletionItem(moduleSuggestion.label, vscode.CompletionItemKind.Module);
        item.insertText = new vscode.SnippetString(`'${moduleSuggestion.label}'`);
        item.detail = moduleSuggestion.detail;
        item.documentation = new vscode.MarkdownString(moduleSuggestion.documentation);
        item.sortText = `0_${moduleSuggestion.label}`;
        return item;
    });
}

function createAnnotationItems(vscode, annotations) {
    return annotations.map((annotationSuggestion) => {
        const item = new vscode.CompletionItem(annotationSuggestion.label, vscode.CompletionItemKind.Snippet);
        item.insertText = new vscode.SnippetString(annotationSuggestion.insertText);
        item.detail = annotationSuggestion.detail;
        item.documentation = new vscode.MarkdownString(annotationSuggestion.documentation);
        item.sortText = `1_${annotationSuggestion.label}`;
        return item;
    });
}

function createEntryPointItems(vscode, scriptType, documentText, entryPointsByType) {
    const entryPoints = entryPointsByType[scriptType] || [];

    return entryPoints
        .filter((entryPoint) => !new RegExp(`\\bfunction\\s+${entryPoint.label}\\s*\\(`).test(documentText))
        .filter((entryPoint) => !new RegExp(`${entryPoint.label}\\s*:\\s*(?:async\\s*)?\\(`).test(documentText))
        .map((entryPoint) => {
            const item = new vscode.CompletionItem(entryPoint.label, vscode.CompletionItemKind.Function);
            item.insertText = new vscode.SnippetString(buildEntryPointSnippet(entryPoint));
            item.detail = entryPoint.detail;
            item.documentation = new vscode.MarkdownString(entryPoint.documentation);
            item.sortText = `2_${entryPoint.label}`;
            return item;
        });
}

function createEnumItems(vscode, dotContext, enums) {
    const moduleEnums = enums[dotContext.modulePath];
    if (!moduleEnums) {
        return [];
    }

    const suggestions = [];
    const propertyPath = dotContext.propertyPath;

    if (propertyPath === '' && moduleEnums.methods) {
        suggestions.push(...moduleEnums.methods.map((method) => createMethodItem(vscode, method, dotContext.alias, '3')));
    }

    if (propertyPath === 'Type.' && moduleEnums.Type) {
        suggestions.push(...moduleEnums.Type.map((enumValue) =>
            createEnumItem(vscode, enumValue, dotContext.alias, 'Type', '4')));
    }

    if (propertyPath === 'FieldType.' && moduleEnums.FieldType) {
        suggestions.push(...moduleEnums.FieldType.map((enumValue) =>
            createEnumItem(vscode, enumValue, dotContext.alias, 'FieldType', '5')));
    }

    if (propertyPath === 'Operator.' && moduleEnums.Operator) {
        suggestions.push(...moduleEnums.Operator.map((enumValue) =>
            createEnumItem(vscode, enumValue, dotContext.alias, 'Operator', '6')));
    }

    if (propertyPath === 'getCurrentScript().' && moduleEnums.Script) {
        suggestions.push(...moduleEnums.Script.map((method) => {
            const item = new vscode.CompletionItem(method.label, vscode.CompletionItemKind.Method);
            item.insertText = new vscode.SnippetString(method.snippet || method.label);
            item.detail = 'Script method';
            item.documentation = new vscode.MarkdownString(method.documentation);
            item.sortText = `7_${method.label}`;
            return item;
        }));
    }

    if (propertyPath === 'getCurrentScript' && moduleEnums.Script) {
        const item = new vscode.CompletionItem('getCurrentScript()', vscode.CompletionItemKind.Method);
        item.insertText = new vscode.SnippetString('getCurrentScript().$0');
        item.detail = 'Runtime method';
        item.documentation = new vscode.MarkdownString('Returns the current script object.');
        item.sortText = '7_getCurrentScript';
        suggestions.push(item);
    }

    return suggestions;
}

function createEnumItem(vscode, enumValue, alias, enumName, sortPrefix) {
    const item = new vscode.CompletionItem(enumValue.label, vscode.CompletionItemKind.EnumMember);
    item.insertText = enumValue.label;
    item.detail = `${alias}.${enumName}`;
    item.documentation = new vscode.MarkdownString(enumValue.documentation);
    item.sortText = `${sortPrefix}_${enumValue.label}`;
    return item;
}

function createMethodItem(vscode, method, alias, sortPrefix) {
    const item = new vscode.CompletionItem(method.label, vscode.CompletionItemKind.Method);
    item.insertText = new vscode.SnippetString(method.snippet || method.label);
    item.detail = `${alias} method`;
    item.documentation = new vscode.MarkdownString(method.documentation);
    item.sortText = `${sortPrefix}_${method.label}`;
    return item;
}

module.exports = {
    createCompletionProvider
};
