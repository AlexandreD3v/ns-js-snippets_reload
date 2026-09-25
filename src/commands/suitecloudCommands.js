const path = require('path');
const {
    requireProject,
    runSuiteCloud,
    runSuiteCloudInTerminal,
    findSuiteCloudProjectRoot
} = require('../services/suitecloudRunner');
const { buildIndex } = require('../sdf/sdfIndex');

function getSuiteCloudCommands(vscode, services) {
    return {
        'netsuite.suitecloudValidate': () => runProjectCommand(vscode, services, ['project:validate'], 'Validate project'),
        'netsuite.suitecloudDeploy': () => deployProject(vscode, services),
        'netsuite.suitecloudUpload': () => uploadActiveFile(vscode, services),
        'netsuite.suitecloudCreateProject': () => createProject(vscode, services),
        'netsuite.suitecloudAccountSetup': () => accountSetup(vscode, services),
        'netsuite.suitecloudImportObject': () => importObject(vscode, services),
        'netsuite.suitecloudImportFile': () => importFile(vscode, services),
        'netsuite.suitecloudOpenRelatedObject': () => openRelatedObject(vscode, services),
        'netsuite.copyScriptForUpload': () => copyScriptForUpload(vscode, services),
        'netsuite.openScriptRecordUrl': () => openScriptRecordUrl(vscode, services)
    };
}

async function runProjectCommand(vscode, { outputChannel }, args, title) {
    const project = await requireProject(vscode);
    if (!project) {
        return;
    }
    return runSuiteCloud(vscode, outputChannel, { root: project.root, args, title });
}

async function deployProject(vscode, services) {
    const project = await requireProject(vscode);
    if (!project) {
        return;
    }

    const validateFirst = vscode.workspace.getConfiguration('netsuite').get('suitecloudValidateBeforeDeploy', true);
    if (validateFirst) {
        const validateResult = await runSuiteCloud(vscode, services.outputChannel, {
            root: project.root,
            args: ['project:validate'],
            title: 'Validate before deploy'
        });
        if (validateResult.exitCode !== 0) {
            const proceed = await vscode.window.showWarningMessage(
                'Validation failed. Deploy anyway?',
                'Deploy',
                'Cancel'
            );
            if (proceed !== 'Deploy') {
                return;
            }
        }
    }

    const args = ['project:deploy'];
    if (project.projectType === 'ACCOUNTCUSTOMIZATION') {
        args.push('--accountspecificvalues', 'WARNING');
    }
    return runSuiteCloud(vscode, services.outputChannel, { root: project.root, args, title: 'Deploy project' });
}

async function uploadActiveFile(vscode, services) {
    const editor = vscode.window.activeTextEditor;
    const project = await requireProject(vscode);
    if (!project || !editor?.document?.uri?.fsPath) {
        return;
    }

    const relative = path.relative(project.fileCabinetPath, editor.document.uri.fsPath).replace(/\\/g, '/');
    if (relative.startsWith('..')) {
        vscode.window.showWarningMessage('Active file is not inside the project FileCabinet folder.');
        return;
    }

    const args = ['file:upload', '--paths', relative];
    return runSuiteCloud(vscode, services.outputChannel, {
        root: project.root,
        args,
        title: 'Upload active file'
    });
}

function createProject(vscode, services) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        vscode.window.showWarningMessage('Open a workspace folder first.');
        return;
    }
    runSuiteCloudInTerminal(vscode, {
        root: folder.uri.fsPath,
        args: ['project:create', '-i'],
        name: 'SuiteCloud Create'
    });
}

function accountSetup(vscode, services) {
    return runProjectCommand(vscode, services, ['account:setup', '-i'], 'Account setup');
}

async function importObject(vscode, services) {
    const project = await requireProject(vscode);
    if (!project) {
        return;
    }
    const scriptId = await vscode.window.showInputBox({ prompt: 'Script/object ID to import (custscript_..., etc.)' });
    if (!scriptId) {
        return;
    }
    return runSuiteCloud(vscode, services.outputChannel, {
        root: project.root,
        args: ['object:import', '--destinationfolder', '/Objects', '--scriptid', scriptId, '--type', 'ALL'],
        title: 'Import SDF object'
    });
}

function importFile(vscode, services) {
    return runProjectCommand(vscode, services, ['file:import', '-i'], 'Import file');
}

async function openRelatedObject(vscode) {
    const editor = vscode.window.activeTextEditor;
    const root = findSuiteCloudProjectRoot(vscode, editor?.document?.uri);
    if (!root || !editor) {
        vscode.window.showWarningMessage('Open a script inside a SuiteCloud project.');
        return;
    }

    const index = buildIndex(root);
    const match = index.scriptObjects.find((item) => path.resolve(item.scriptPath) === path.resolve(editor.document.uri.fsPath));
    if (!match) {
        vscode.window.showWarningMessage('No related SDF object XML found for this script.');
        return;
    }

    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(match.objectPath));
}

async function copyScriptForUpload(vscode) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    await vscode.env.clipboard.writeText(editor.document.getText());
    vscode.window.showInformationMessage('Active script copied to clipboard for Script Editor upload.');
}

async function openScriptRecordUrl(vscode) {
    const config = vscode.workspace.getConfiguration('netsuite');
    const template = config.get('scriptRecordUrlTemplate', '');
    if (!template) {
        vscode.window.showWarningMessage('Set netsuite.scriptRecordUrlTemplate to your account script record URL pattern.');
        return;
    }
    const scriptId = await vscode.window.showInputBox({ prompt: 'Script internal ID or scriptid parameter value' });
    if (!scriptId) {
        return;
    }
    const url = template.replace('{id}', encodeURIComponent(scriptId));
    await vscode.env.openExternal(vscode.Uri.parse(url));
}

module.exports = {
    getSuiteCloudCommands
};
