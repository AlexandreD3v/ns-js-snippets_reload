const {
    detectImportedModules,
    detectScriptType
} = require('../utils/parseSuiteScript');

function createHoverProvider(vscode, data) {
    return vscode.languages.registerHoverProvider(
        { language: 'javascript' },
        {
            provideHover(document, position) {
                const range = document.getWordRangeAtPosition(position, /[@A-Za-z_][\w.]*/);
                if (!range) {
                    return null;
                }

                const word = document.getText(range);
                const line = document.lineAt(position.line).text;
                const documentText = document.getText();

                const moduleHover = findModuleHover(word, line, data.modules);
                if (moduleHover) {
                    return new vscode.Hover(formatHover(vscode, moduleHover.title, moduleHover.documentation), range);
                }

                const annotationHover = findAnnotationHover(word, data.annotations);
                if (annotationHover) {
                    return new vscode.Hover(formatHover(vscode, annotationHover.title, annotationHover.documentation), range);
                }

                const entryPointHover = findEntryPointHover(word, detectScriptType(documentText), data.entryPoints);
                if (entryPointHover) {
                    return new vscode.Hover(formatHover(vscode, entryPointHover.title, entryPointHover.documentation), range);
                }

                const enumHover = findEnumHover(word, line, detectImportedModules(documentText), data.enums);
                if (enumHover) {
                    return new vscode.Hover(formatHover(vscode, enumHover.title, enumHover.documentation), range);
                }

                return null;
            }
        }
    );
}

function findModuleHover(word, line, modules) {
    const modulePath = word.startsWith('N/') ? word : null;
    if (!modulePath) {
        const quotedMatch = line.match(/['"](N\/[^'"]+)['"]/);
        if (quotedMatch && line.includes(word)) {
            const moduleSuggestion = modules.find((module) => module.label === quotedMatch[1]);
            if (moduleSuggestion) {
                return { title: moduleSuggestion.label, documentation: moduleSuggestion.documentation };
            }
        }
        return null;
    }

    const moduleSuggestion = modules.find((module) => module.label === modulePath);
    if (!moduleSuggestion) {
        return null;
    }

    return { title: moduleSuggestion.label, documentation: moduleSuggestion.documentation };
}

function findAnnotationHover(word, annotations) {
    const normalizedWord = word.startsWith('@') ? word : `@${word}`;
    const annotation = annotations.find((item) =>
        item.label.toLowerCase().startsWith(normalizedWord.toLowerCase()) ||
        item.insertText.toLowerCase().startsWith(normalizedWord.toLowerCase())
    );

    if (!annotation) {
        return null;
    }

    return { title: annotation.label, documentation: annotation.documentation };
}

function findEntryPointHover(word, scriptType, entryPointsByType) {
    const scriptEntryPoints = scriptType ? entryPointsByType[scriptType] || [] : [];
    const allEntryPoints = Object.values(entryPointsByType).flat();
    const entryPoint = scriptEntryPoints.find((item) => item.label === word) ||
        allEntryPoints.find((item) => item.label === word);

    if (!entryPoint) {
        return null;
    }

    return { title: entryPoint.label, documentation: `${entryPoint.detail}. ${entryPoint.documentation}` };
}

function findEnumHover(word, line, importedModules, enums) {
    for (const importedModule of importedModules) {
        const moduleEnums = enums[importedModule.path];
        if (!moduleEnums) {
            continue;
        }

        const collections = [
            moduleEnums.Type,
            moduleEnums.FieldType,
            moduleEnums.Operator,
            moduleEnums.methods,
            moduleEnums.Script
        ].filter(Boolean);

        for (const collection of collections) {
            const match = collection.find((item) => item.label === word);
            if (match && line.includes(importedModule.alias)) {
                return { title: `${importedModule.alias}.${word}`, documentation: match.documentation };
            }
        }
    }

    return null;
}

function formatHover(vscode, title, documentation) {
    return new vscode.MarkdownString(`**${title}**\n\n${documentation}`);
}

module.exports = {
    createHoverProvider
};
