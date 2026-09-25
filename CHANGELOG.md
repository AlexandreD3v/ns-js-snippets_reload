# Changelog

## 0.8.0

- **0.7.1 hardening:** fixed Developer Assistant command crash, script record URL `{scriptId}` / `{id}` placeholders, safer 2.1 conversion scoped to `return { }` entry points, quieter migration audit, SuiteQL extract limited to `runSuiteQL`, added `.vscodeignore` and GitHub CI.
- **SuiteQL:** import schema from JSON or CSV into the workspace schema file.
- **SuiteScript parsing:** AST-backed module import and export detection with regex fallback.
- **SDF:** indexed custom field definitions for fast go-to-field navigation.
- **MCP:** workspace-aware stdio server tools (`NS_MCP_WORKSPACE`) for summary, file context, and SDF script objects.
- Removed default `.sql` language association to avoid conflicts with generic SQL extensions.

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
