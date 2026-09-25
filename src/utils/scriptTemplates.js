const SCRIPT_TYPE_OPTIONS = [
    { label: 'Client Script', annotation: 'ClientScript', key: 'clientscript' },
    { label: 'User Event Script', annotation: 'UserEventScript', key: 'usereventscript' },
    { label: 'Suitelet', annotation: 'Suitelet', key: 'suitelet' },
    { label: 'RESTlet', annotation: 'Restlet', key: 'restlet' },
    { label: 'Map/Reduce Script', annotation: 'MapReduceScript', key: 'mapreducescript' },
    { label: 'Scheduled Script', annotation: 'ScheduledScript', key: 'scheduledscript' },
    { label: 'Mass Update Script', annotation: 'MassUpdateScript', key: 'massupdatescript' },
    { label: 'Portlet', annotation: 'Portlet', key: 'portlet' },
    { label: 'Workflow Action Script', annotation: 'WorkflowActionScript', key: 'workflowactionscript' },
    { label: 'Bundle Installation Script', annotation: 'BundleInstallationScript', key: 'bundleinstallationscript' }
];

function buildScriptContent(scriptTypeKey, entryPointsByType, options) {
    const apiVersion = options.apiVersion || '2.1';
    const moduleScope = options.moduleScope || 'SameAccount';
    const scriptType = SCRIPT_TYPE_OPTIONS.find((item) => item.key === scriptTypeKey);

    if (!scriptType) {
        throw new Error(`Unknown script type: ${scriptTypeKey}`);
    }

    const entryPoints = entryPointsByType[scriptTypeKey] || [];
    const returnEntries = entryPoints.map((entryPoint) => {
        const signature = entryPoint.parameterName === ''
            ? '()'
            : `(${entryPoint.parameterName || 'context'})`;
        const body = entryPoint.validator ? '\n            return true;' : '';
        return `        ${entryPoint.label}: ${signature} => {${body}\n        }`;
    });

    return [
        '/**',
        ` * @NApiVersion ${apiVersion}`,
        ` * @NScriptType ${scriptType.annotation}`,
        ` * @NModuleScope ${moduleScope}`,
        ' */',
        'define([], function () {',
        '',
        '    return {',
        returnEntries.join(',\n'),
        '    };',
        '});',
        ''
    ].join('\n');
}

function getScriptTypeOptions() {
    return SCRIPT_TYPE_OPTIONS;
}

function findScriptTypeByLabel(label) {
    return SCRIPT_TYPE_OPTIONS.find((item) => item.label === label);
}

module.exports = {
    buildScriptContent,
    getScriptTypeOptions,
    findScriptTypeByLabel,
    SCRIPT_TYPE_OPTIONS
};
