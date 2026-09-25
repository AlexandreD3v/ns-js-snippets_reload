const path = require('path');
const fs = require('fs');
const { getCustomFieldsConfigPath } = require('../utils/customFields');
const { pickFolder } = require('../utils/workspace');

function getFieldCommands(vscode, services) {
    return {
        'netsuite.reloadCustomFields': () => reloadCustomFields(vscode, services),
        'netsuite.createCustomFieldsConfig': () => createCustomFieldsConfig(vscode, services)
    };
}

function reloadCustomFields(vscode, { customFieldStore }) {
    const results = customFieldStore.reload();
    if (results.length === 0) {
        vscode.window.showInformationMessage('Open a workspace folder to load custom field suggestions.');
        return;
    }

    const total = results.reduce((sum, result) => sum + result.count, 0);
    vscode.window.showInformationMessage(
        `Loaded ${total} custom field IDs across ${results.length} workspace folder(s).`
    );
}

async function createCustomFieldsConfig(vscode, { extensionPath, customFieldStore }) {
    const folder = await pickFolder(vscode, 'Select the workspace folder for netsuite-fields.json');
    if (!folder) {
        vscode.window.showWarningMessage('Open a workspace folder first.');
        return;
    }

    const targetPath = getCustomFieldsConfigPath(vscode, folder);
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(path.join(extensionPath, 'resources', 'netsuite-fields.example.json'), targetPath);
    }

    customFieldStore.reload();
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(targetPath));
}

module.exports = {
    getFieldCommands
};
