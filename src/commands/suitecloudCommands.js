const path = require('path');
const {
    requireProject,
    runSuiteCloud,
    runInteractiveSuiteCloud,
    findSuiteCloudProjectRoot,
    ensureCli,
    getCliPath
} = require('../services/suitecloudRunner');
const {
    readProjectAuth,
    buildAccountPrompt,
    fileCabinetArgument,
    interpretValidationResult
} = require('../services/projectAccount');
const { buildIndex, findScriptObjectForFile } = require('../sdf/sdfIndex');

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

async function confirmProjectAccount(vscode, project, action) {
    const executable = getCliPath(vscode, vscode.Uri.file(project.root));
    if (!(await ensureCli(vscode, executable, project.root))) {
        return false;
    }

    const alwaysConfirm = vscode.workspace.getConfiguration('netsuite', vscode.Uri.file(project.root))
        .get('suitecloudAlwaysConfirmAccount', true);
    const prompt = buildAccountPrompt({
        action,
        auth: readProjectAuth(project.root),
        alwaysConfirm
    });
    if (!prompt) {
        return true;
    }

    const proceed = await vscode.window.showWarningMessage(
        prompt.message,
        { modal: true, detail: prompt.detail },
        prompt.confirmLabel,
        'Cancel'
    );
    return proceed === prompt.confirmLabel;
}

async function deployProject(vscode, services) {
    const project = await requireProject(vscode);
    if (!project) {
        return;
    }
    if (!(await confirmProjectAccount(vscode, project, 'deploy'))) {
        return;
    }

    const validateFirst = vscode.workspace.getConfiguration('netsuite').get('suitecloudValidateBeforeDeploy', true);
    if (validateFirst) {
        const validateResult = await runSuiteCloud(vscode, services.outputChannel, {
            root: project.root,
            args: ['project:validate'],
            title: 'Validate before deploy'
        });
        const outcome = interpretValidationResult(validateResult);
        if (outcome === 'stop') {
            return;
        }
        if (outcome === 'ask') {
            const proceed = await vscode.window.showWarningMessage(
                'Validation failed. Deploy anyway?',
                { modal: true },
                'Deploy anyway',
                'Cancel'
            );
            if (proceed !== 'Deploy anyway') {
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
    if (!editor?.document?.uri?.fsPath) {
        vscode.window.showWarningMessage('Open a file inside the project FileCabinet folder.');
        return;
    }
    const project = await requireProject(vscode);
    if (!project) {
        return;
    }

    const relative = path.relative(project.fileCabinetPath, editor.document.uri.fsPath);
    const cabinetPath = relative.startsWith('..') || path.isAbsolute(relative)
        ? null
        : fileCabinetArgument(relative);
    if (!cabinetPath) {
        vscode.window.showWarningMessage('Active file is not inside the project FileCabinet folder.');
        return;
    }
    if (!(await confirmProjectAccount(vscode, project, 'upload'))) {
        return;
    }

    const args = ['file:upload', '--paths', cabinetPath];
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
    return runInteractiveSuiteCloud(vscode, services.outputChannel, {
        root: folder.uri.fsPath,
        args: ['project:create', '-i'],
        name: 'SuiteCloud Create',
        title: 'Create project'
    });
}

async function accountSetup(vscode, services) {
    const project = await requireProject(vscode);
    if (!project) {
        return;
    }
    return runInteractiveSuiteCloud(vscode, services.outputChannel, {
        root: project.root,
        args: ['account:setup', '-i'],
        name: 'SuiteCloud Account Setup',
        title: 'Account setup'
    });
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

async function importFile(vscode, services) {
    const project = await requireProject(vscode);
    if (!project) {
        return;
    }
    return runInteractiveSuiteCloud(vscode, services.outputChannel, {
        root: project.root,
        args: ['file:import', '-i'],
        name: 'SuiteCloud Import File',
        title: 'Import file'
    });
}

async function openRelatedObject(vscode) {
    const editor = vscode.window.activeTextEditor;
    const root = findSuiteCloudProjectRoot(vscode, editor?.document?.uri);
    if (!root || !editor) {
        vscode.window.showWarningMessage('Open a script inside a SuiteCloud project.');
        return;
    }

    const index = buildIndex(root);
    const match = findScriptObjectForFile(index, editor.document.uri.fsPath);
    if (!match) {
        vscode.window.showWarningMessage('No related SDF object XML found for this script. The script file path in the object is resolved under FileCabinet.');
        return;
    }

    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(match.objectPath));
    vscode.window.showInformationMessage(
        match.scriptId ? `Opened SDF object ${match.scriptId}.` : 'Opened the related SDF object.'
    );
}

async function copyScriptForUpload(vscode) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Open a script to copy for manual upload.');
        return;
    }
    await vscode.env.clipboard.writeText(editor.document.getText());
    vscode.window.showInformationMessage('Active script copied to clipboard for Script Editor upload.');
}

function fillScriptRecordUrl(template, scriptId) {
    if (!template || !/\{scriptId\}|\{id\}/.test(template)) {
        return null;
    }
    const encoded = encodeURIComponent(scriptId);
    return template.replace(/\{scriptId\}/g, encoded).replace(/\{id\}/g, encoded);
}

async function openScriptRecordUrl(vscode) {
    const config = vscode.workspace.getConfiguration('netsuite');
    const template = config.get('scriptRecordUrlTemplate', '');
    if (!template) {
        vscode.window.showWarningMessage('Set netsuite.scriptRecordUrlTemplate to your account script record URL pattern. Use {scriptId} as the placeholder.');
        return;
    }
    const scriptId = await vscode.window.showInputBox({ prompt: 'Script internal ID or scriptid parameter value' });
    if (!scriptId) {
        return;
    }
    const url = fillScriptRecordUrl(template, scriptId);
    if (!url) {
        vscode.window.showWarningMessage('netsuite.scriptRecordUrlTemplate must include {scriptId} (or {id}).');
        return;
    }
    const opened = await vscode.env.openExternal(vscode.Uri.parse(url));
    if (!opened) {
        vscode.window.showErrorMessage(`Could not open the script record URL: ${url}`);
        return;
    }
    vscode.window.showInformationMessage('Opened the script record URL.');
}

module.exports = {
    getSuiteCloudCommands,
    fillScriptRecordUrl,
    confirmProjectAccount
};
