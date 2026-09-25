const path = require('path');
const fs = require('fs');

function getWorkspaceFolders(vscode) {
    return vscode.workspace.workspaceFolders || [];
}

function getFolderForUri(vscode, uri) {
    if (!uri) {
        return null;
    }

    if (vscode.workspace.getWorkspaceFolder) {
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        if (folder) {
            return folder;
        }
    }

    return findContainingFolder(getWorkspaceFolders(vscode), uri.fsPath);
}

function findContainingFolder(folders, filePath) {
    if (!filePath) {
        return null;
    }

    const matches = folders.filter((folder) => isInside(folder.uri.fsPath, filePath));
    matches.sort((a, b) => b.uri.fsPath.length - a.uri.fsPath.length);
    return matches[0] || null;
}

function getActiveFolder(vscode) {
    const activeUri = vscode.window.activeTextEditor?.document?.uri;
    return getFolderForUri(vscode, activeUri) || getWorkspaceFolders(vscode)[0] || null;
}

async function pickFolder(vscode, placeHolder) {
    const folders = getWorkspaceFolders(vscode);
    if (folders.length <= 1) {
        return folders[0] || null;
    }

    const active = getActiveFolder(vscode);
    if (active && vscode.window.activeTextEditor) {
        return active;
    }

    return vscode.window.showWorkspaceFolderPick({ placeHolder });
}

function isInside(parentPath, childPath) {
    const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function findUp(startPath, markers, stopAt) {
    let current = fs.existsSync(startPath) && fs.statSync(startPath).isDirectory()
        ? startPath
        : path.dirname(startPath);
    const boundary = stopAt ? path.resolve(stopAt) : null;

    while (true) {
        for (const marker of markers) {
            if (fs.existsSync(path.join(current, marker))) {
                return current;
            }
        }

        const parent = path.dirname(current);
        if (parent === current || (boundary && path.resolve(current) === boundary)) {
            return null;
        }
        current = parent;
    }
}

function listFiles(rootPath, predicate, ignoredDirectories = ['node_modules', '.git', '.netsuite']) {
    const results = [];
    const stack = [rootPath];

    while (stack.length > 0) {
        const current = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (!ignoredDirectories.includes(entry.name)) {
                    stack.push(fullPath);
                }
            } else if (predicate(fullPath)) {
                results.push(fullPath);
            }
        }
    }

    return results.sort();
}

module.exports = {
    getWorkspaceFolders,
    getFolderForUri,
    findContainingFolder,
    getActiveFolder,
    pickFolder,
    isInside,
    findUp,
    listFiles
};
