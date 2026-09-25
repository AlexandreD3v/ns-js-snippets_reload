const { getApiVersion, detectScriptType, hasDefine } = require('../utils/parseSuiteScript');
const { analyzeBehaviorRisks } = require('./behaviorRules');

function auditText(text, filePath = '') {
    const inventory = {
        filePath,
        apiVersion: getApiVersion(text),
        scriptType: detectScriptType(text),
        hasDefine: hasDefine(text),
        needsUpgrade: false,
        manualReview: [],
        info: []
    };

    if (!inventory.apiVersion && inventory.hasDefine) {
        inventory.manualReview.push('Missing @NApiVersion annotation.');
        inventory.needsUpgrade = true;
    }

    if (inventory.apiVersion && inventory.apiVersion !== '2.1') {
        inventory.needsUpgrade = true;
        inventory.info.push(`Current @NApiVersion is ${inventory.apiVersion}; target is 2.1.`);
    }

    inventory.manualReview.push(...analyzeBehaviorRisks(text));
    return inventory;
}

function auditWorkspace(files) {
    const results = files.map((file) => auditText(file.content, file.path));
    const summary = {
        total: results.length,
        needsUpgrade: results.filter((item) => item.needsUpgrade).length,
        withManualReview: results.filter((item) => item.manualReview.length > 0).length
    };
    return { summary, results };
}

function toMarkdownReport(report) {
    const lines = [
        '# SuiteScript 2.1 readiness audit',
        '',
        `- Files scanned: ${report.summary.total}`,
        `- Files needing upgrade: ${report.summary.needsUpgrade}`,
        `- Files with manual-review items: ${report.summary.withManualReview}`,
        '',
        '## Account checklist (manual)',
        '- Confirm whether **Execute SuiteScript 2.x Server Scripts As** is set to 2.1 if you rely on account-level execution.',
        '- Verify each script record **Execute As Version** after upload.',
        '- No official public deadline for removing 2.0 was verified; treat 2.1 as the recommended standard.',
        ''
    ];

    for (const item of report.results) {
        if (!item.needsUpgrade && item.manualReview.length === 0) {
            continue;
        }
        lines.push(`### ${item.filePath || 'untitled'}`);
        lines.push(`- @NApiVersion: ${item.apiVersion || 'missing'}`);
        lines.push(`- @NScriptType: ${item.scriptType || 'missing'}`);
        for (const note of item.info) {
            lines.push(`- ${note}`);
        }
        for (const note of item.manualReview) {
            lines.push(`- Manual review: ${note}`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

module.exports = {
    auditText,
    auditWorkspace,
    toMarkdownReport
};
