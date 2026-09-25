const path = require('path');
const fs = require('fs');
const { getWorkspaceFolders, getFolderForUri, findUp } = require('../utils/workspace');
const { buildCommandLine, runProcess } = require('../utils/processRunner');

const CONFIG_MARKER = 'suitecloud.config.js';

function findSuiteCloudProjectRoot(vscode, uri) {
    const targetUri = uri || vscode.window.activeTextEditor?.document?.uri;

    if (targetUri?.scheme === 'file') {
        const folder = getFolderForUri(vscode, targetUri);
        const root = findProjectRootFromPath(targetUri.fsPath, folder?.uri.fsPath);
        if (root) {
            return root;
        }
    }

    for (const folder of getWorkspaceFolders(vscode)) {
        const root = findProjectRootFromPath(folder.uri.fsPath, folder.uri.fsPath);
        if (root) {
            return root;
        }
    }

    return null;
}

function findProjectRootFromPath(startPath, stopAt) {
    const configRoot = findUp(startPath, [CONFIG_MARKER], stopAt);
    if (configRoot) {
        return configRoot;
    }

    const manifestRoot = findUp(startPath, ['manifest.xml'], stopAt);
    if (!manifestRoot) {
        return null;
    }

    const parent = path.dirname(manifestRoot);
    return fs.existsSync(path.join(parent, CONFIG_MARKER)) ? parent : manifestRoot;
}

function getProjectInfo(root) {
    const configPath = path.join(root, CONFIG_MARKER);
    let projectFolderName = fs.existsSync(path.join(root, 'src', 'manifest.xml')) ? 'src' : '';

    if (fs.existsSync(configPath)) {
        const match = fs.readFileSync(configPath, 'utf8').match(/defaultProjectFolder\s*:\s*['"]([^'"]+)['"]/);
        if (match) {
            projectFolderName = match[1];
        }
    }

    const projectFolder = path.join(root, projectFolderName);
    const manifestPath = path.join(projectFolder, 'manifest.xml');
    const manifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '';
    const typeMatch = manifest.match(/projecttype\s*=\s*"([A-Z]+)"/i);

    return {
        root,
        projectFolder,
        manifestPath: manifest ? manifestPath : null,
        deployPath: fs.existsSync(path.join(projectFolder, 'deploy.xml')) ? path.join(projectFolder, 'deploy.xml') : null,
        fileCabinetPath: path.join(projectFolder, 'FileCabinet'),
        objectsPath: path.join(projectFolder, 'Objects'),
        projectType: typeMatch ? typeMatch[1].toUpperCase() : 'UNKNOWN'
    };
}

function getCliPath(vscode, uri) {
    return vscode.workspace.getConfiguration('netsuite', uri).get('suitecloudPath', 'suitecloud');
}

async function checkCli(executable, cwd) {
    const result = await runProcess(executable, ['--version'], { cwd });
    return {
        available: result.exitCode === 0,
        version: result.output.trim().split(/\r?\n/).pop() || ''
    };
}

async function requireProject(vscode) {
    const root = findSuiteCloudProjectRoot(vscode);
    if (!root) {
        vscode.window.showWarningMessage(
            'No SuiteCloud project detected. Open a folder containing suitecloud.config.js or manifest.xml.'
        );
        return null;
    }
    return getProjectInfo(root);
}

async function ensureCli(vscode, executable, cwd) {
    const cli = await checkCli(executable, cwd);
    if (!cli.available) {
        vscode.window.showErrorMessage(
            `SuiteCloud CLI was not found ("${executable}"). Install @oracle/suitecloud-cli or set netsuite.suitecloudPath.`
        );
    }
    return cli.available;
}

async function runSuiteCloud(vscode, outputChannel, { root, args, title }) {
    const executable = getCliPath(vscode, vscode.Uri.file(root));
    if (!(await ensureCli(vscode, executable, root))) {
        return { exitCode: -1, output: '', cancelled: false };
    }

    outputChannel.show(true);
    outputChannel.appendLine('');
    outputChannel.appendLine(`> ${buildCommandLine(executable, args)}`);
    outputChannel.appendLine(`  (in ${root})`);

    const result = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: title || `SuiteCloud ${args[0]}`,
            cancellable: true
        },
        (_progress, token) => runProcess(executable, args, {
            cwd: root,
            token,
            onOutput: (text) => outputChannel.append(text)
        })
    );

    if (result.cancelled) {
        outputChannel.appendLine('SuiteCloud command cancelled.');
        vscode.window.showWarningMessage(`${title || args[0]} was cancelled.`);
    } else if (result.exitCode === 0) {
        outputChannel.appendLine('SuiteCloud command completed successfully.');
        vscode.window.showInformationMessage(`${title || args[0]} completed.`);
    } else {
        outputChannel.appendLine(`SuiteCloud command failed with exit code ${result.exitCode}.`);
        vscode.window.showErrorMessage(`${title || args[0]} failed. See the NetSuite SuiteScript output for details.`);
    }

    return result;
}

function runSuiteCloudInTerminal(vscode, { root, args, name }) {
    const executable = getCliPath(vscode, vscode.Uri.file(root));
    const terminal = vscode.window.createTerminal({ name: name || 'SuiteCloud', cwd: root });
    terminal.show();
    terminal.sendText(buildCommandLine(executable, args), true);
    return terminal;
}

module.exports = {
    findSuiteCloudProjectRoot,
    findProjectRootFromPath,
    getProjectInfo,
    getCliPath,
    checkCli,
    requireProject,
    runSuiteCloud,
    runSuiteCloudInTerminal
};
