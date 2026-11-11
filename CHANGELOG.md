# Changelog

## Unreleased

## 0.7.1

- Marketplace display name is now **SuiteScript Toolkit for NetSuite**. The extension id and the `name` field stay `alexandrejcorrea.ns-js-snippets-reload`.
- Description, keywords, and categories present the extension as a SuiteScript toolkit (snippets, the SuiteQL language, and diagnostics).
- `bugs` and `homepage` point at the GitHub repository. The SPDX license stays `GPL-3.0-only`.
- Package with `@vscode/vsce` instead of the deprecated `vsce` package.
- `.vscodeignore` keeps tests, CI files, internal docs, source maps, and TypeScript declarations out of the VSIX. Committed `.vsix` files were removed from the repository, and `*.vsix` is gitignored.
- Load the existing SuiteScript snippets in TypeScript, JavaScript React, and TypeScript React files. Snippet prefixes are unchanged.
- Show each command once in the palette as `NetSuite: <title>`. Titles no longer repeat the NetSuite category.
- Fix SuiteScript 2.1 preview and workspace conversion so only real SuiteScript edits are saved.
- Insert SuiteQL into JavaScript, run interactive SuiteCloud commands in the terminal, and correct SDF script paths and script-record URLs.
- Support arrow-function `define()` callbacks, custom field XML navigation, safer Jest scaffolds, and language model tool registration.
- Show the Marketplace rating reminder after real use without resetting it on every patch, and add a hidden preview command.

## 0.7.0

- SuiteScript **2.1 audit and conversion** with preview diff before apply (workspace or current file).
- **SuiteQL** language (`.suiteql`), schema-aware completion, diagnostics in JS and SuiteQL, and extract/insert commands.
- **SDF intelligence**: index script objects, optional field ID discovery from Objects XML, open related SDF object, copy-for-upload helpers.
- **SuiteCloud CLI** runner with cancellable progress, validate-before-deploy option, and additional project/import commands.
- **Governance diagnostics**, N/* import helper, go-to field definition, and Jest test scaffold command.
- **AI helpers**: sanitized context copy, optional VS Code language model tools (when supported), Developer Assistant terminal setup, optional MCP stub under `mcp/`.
- Foundation utilities (multi-root workspace, safe CLI quoting), expanded tests, and engine **1.85+**.

## 0.2.0

- Added NetSuite commands: new script template, insert parameters block, wrap selection in `define()`, validate file.
- Added workspace custom field autocomplete via `.vscode/netsuite-fields.json`.
- Added SuiteCloud CLI helpers: deploy, validate, and upload commands.
- Added example custom fields file and Tier 2 tests.

## 0.1.1

- Improved Marketplace README with full feature documentation and rating invitation.
- Updated extension summary description in `package.json`.

## 0.1.0

- SuiteScript snippets, autocomplete, hover documentation, and diagnostics.
- Pattern snippets for searches, parameters, governance, SuiteQL, and records.
- Marketplace rating prompt (local storage only, no telemetry).
