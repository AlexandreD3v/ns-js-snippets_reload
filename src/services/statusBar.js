function createStatusBar(vscode, context) {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    item.command = 'netsuite.suitecloudValidate';
    context.subscriptions.push(item);

    const refresh = () => {
        const { findSuiteCloudProjectRoot } = require('./suitecloudRunner');
        const root = findSuiteCloudProjectRoot(vscode, vscode.window.activeTextEditor?.document?.uri);
        if (!root) {
            item.hide();
            return;
        }
        item.text = '$(cloud) NetSuite SDF';
        item.tooltip = `SuiteCloud project: ${root}`;
        item.show();
    };

    refresh();
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(refresh),
        vscode.workspace.onDidChangeWorkspaceFolders(refresh)
    );
}

module.exports = {
    createStatusBar
};
