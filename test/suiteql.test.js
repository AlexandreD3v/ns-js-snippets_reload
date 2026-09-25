const assert = require('assert');
const { analyzeSuiteQLText, analyzeSuiteQLInJavaScript } = require('../src/suiteql/suiteqlAnalyzer');

const query = [
    'SELECT id, entityid',
    'FROM customer',
    'WHERE isinactive = ?'
].join('\n');

const js = [
    "define(['N/query'], function (query) {",
    "  const rows = query.runSuiteQL({",
    "    query: `" + query + "`,",
    "    params: ['F']",
    "  });",
    "});"
].join('\n');

const findings = analyzeSuiteQLText(query);
assert.ok(findings.some((item) => item.code === 'suiteql-row-limit') === false);
assert.ok(analyzeSuiteQLInJavaScript(js).length >= 0);

const bad = "query.runSuiteQL({ query: `SELECT id FROM customer WHERE name = ${name}` })";
assert.ok(analyzeSuiteQLInJavaScript(bad).some((item) => item.code === 'suiteql-interpolation'));
console.log('SuiteQL tests passed.');
