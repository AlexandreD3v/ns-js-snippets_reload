# NetSuite – JS Snippets Reload

**SuiteScript 2.x productivity for VS Code** — snippets, smart autocomplete, hover help, and lightweight validation while you write NetSuite JavaScript.

Works in any `.js` file. Activates when you edit JavaScript (typical SuiteScript 2.x AMD modules with `define([...], function () { ... })`).

---

## Why use this extension?

NetSuite customization in VS Code often means repeating the same boilerplate: JSDoc headers, `define()` dependencies, entry points per script type, searches, governance checks, and Suitelet forms. This extension cuts that down so you can focus on business logic instead of docs and copy-paste.

| Capability | What you get |
|------------|----------------|
| **Snippets** | Full script templates + small entry-point and API pattern snippets |
| **Autocomplete** | `N/*` modules, annotations, script entry points, common enums |
| **Hover** | Short explanations for modules, annotations, entry points, enums |
| **Diagnostics** | Warnings for missing annotations, wrong entry points, export issues, SuiteQL safety, governance hints |
| **SuiteQL** | `.suiteql` files, table/column completion, extract from `N/query` |
| **2.1 migration** | Workspace audit and previewed conversion to `@NApiVersion 2.1` |
| **SDF / SuiteCloud** | CLI commands, project detection, related script object navigation |

---

## Snippets

### Full script scaffolds

Type the prefix and accept the suggestion (Tab) to insert a complete starting file:

- **ClientScript** — `ClientScript`, `ClientScriptHelloWorld`, `ClientScriptNSSample`
- **User Event** — `UserEvent`, `UserEventHelloWorld`, `UserEventNsSample`
- **Suitelet** — `Suitelet`, `SuiteletHelloWorld`, `SuiteletNSSampleForm`
- **RESTlet** — `RESTlet`, `RESTletHelloWorld`, `RESTletNsSample`
- **Map/Reduce** — `MapReduce`, `MapReduceNSSample`
- **Other types** — `scheduledscript`, `massupdatescript`, `portlet`, `workflowactionscript`, `bundleinstallationscript`

### Entry-point snippets

Individual handlers when you already have a script shell, for example:

`pageInit`, `fieldChanged`, `validateField`, `saveRecord`, `beforeLoad`, `beforeSubmit`, `afterSubmit`, `onRequest`, `get`, `post`, `put`, `_delete`, `getInputData`, `map`, `reduce`, `summarize`, `execute`, `onAction`, and more.

### Pattern snippets (daily API work)

| Prefix | Inserts |
|--------|---------|
| `define` | AMD `define([...], function () { ... })` wrapper |
| `nsSearch` | `search.create` with filters and columns |
| `nsSearchRun` | `search.run().each()` loop |
| `nsSearchGovernance` | Search loop with governance guard |
| `nsSublist` | Sublist line iteration |
| `nsParam` | Script deployment parameter read |
| `nsTryCatch` | try/catch with `N/log` and `N/error` |
| `nsGovernance` | `getRemainingUsage()` check |
| `nsSuiteletForm` | Minimal Suitelet form + field |
| `nsSuiteQL` | `query.runSuiteQL` template |
| `nsDeployParam` | Script parameter documentation block |
| `nsRecordLoad` | `record.load` by type and ID |
| `nsRecordSubmit` | `setValue` + `save` |
| `nRecordSamples` | Example `N/record` usage patterns |

NetSuite-style samples (forms, Map/Reduce word count, etc.) are included for learning and adaptation.

---

## Autocomplete

Suggestions appear while you type in JavaScript files (trigger-friendly on `/`, `@`, `.`, quotes).

### `N/*` modules (26 modules)

Inside `define([...])` or when typing a module path, for example:

`N/record`, `N/search`, `N/log`, `N/runtime`, `N/query`, `N/https`, `N/ui/serverWidget`, `N/file`, `N/email`, `N/format`, and others.

### SuiteScript annotations

In JSDoc or when typing `@`:

- `@NApiVersion 2.x` / `2.1`
- `@NModuleScope SameAccount` / `Public`
- `@NScriptType` for Client Script, User Event, Suitelet, RESTlet, Map/Reduce, Scheduled, Mass Update, Portlet, Workflow Action, Bundle Installation
- `@NAmdConfigPath`

### Contextual entry points

The extension reads `@NScriptType` in the file and suggests **only entry points that are not already implemented** — for example Client Script `pageInit`, `fieldChanged`, `saveRecord`, or Suitelet `onRequest` with GET/POST branches.

### Enums and common API shapes

After you import modules and use their AMD aliases:

- `record.Type.*` (e.g. `SALES_ORDER`, `CUSTOMER`, `INVOICE`)
- `search.Type.*` and `search.Operator.*`
- `serverWidget.FieldType.*`
- `log.debug`, `log.audit`, `log.error`, `log.emergency`
- `runtime.getCurrentScript().getParameter()`, `getRemainingUsage()`

---

## Hover documentation

Hover over:

- Module names in `define([...])`
- `@NScriptType` and related annotations
- Entry point names (`beforeSubmit`, `onRequest`, …)
- Common enum values when used with an imported alias

You get a short description without leaving the editor.

---

## Diagnostics

Optional SuiteScript-oriented checks in `.js` files (on by default):

- Missing `@NApiVersion` when the file uses `define(...)`
- Missing or inconsistent `@NScriptType`
- Entry points that do not match the declared script type
- Entry point functions defined but not exported in `return { }`
- Hint when arrow functions in `return { }` need `@NApiVersion 2.1` instead of `2.0`

Turn off in Settings: **`netsuite.enableDiagnostics`**. Governance hints use **`netsuite.enableGovernanceDiagnostics`**.

SuiteQL-related warnings appear inside `query.runSuiteQL` template literals and in `.suiteql` files.

---

## SuiteScript 2.1 migration

- **NetSuite: Audit Workspace for SuiteScript 2.1** — markdown report of API versions and manual-review items.
- **NetSuite: Convert Current Script to 2.1 (Preview)** — side-by-side diff; apply only when you confirm.
- **NetSuite: Convert Workspace Scripts to 2.1** — batch conversion with the same preview flow.

Conversion updates `@NApiVersion` to **2.1** and modernizes simple `return { handler: function () {} }` patterns to arrow functions where safe. Behavior-sensitive patterns are flagged for manual review (Oracle has not published a verified “2.1-only” deadline—treat 2.1 as the recommended standard).

---

## SuiteQL workbench

- Open or create **`.suiteql`** files with basic syntax highlighting.
- **NetSuite: Import SuiteQL Schema (JSON/CSV)** merges table/column metadata into your workspace schema file.
- Completion uses bundled table metadata plus optional [schema overrides](resources/netsuite-suiteql-schema.example.json) at **`netsuite.suiteqlSchemaPath`**.
- **Extract SuiteQL from JavaScript** / **Insert SuiteQL as N/query block** from the editor context menu.

---

## Commands

Open the Command Palette and search **NetSuite** (grouped by area):

| Area | Examples |
|------|----------|
| **Scripts** | New template, parameters block, wrap in `define()`, validate file |
| **Fields** | Reload custom fields, create example config |
| **2.1** | Audit workspace, convert current file or workspace |
| **SuiteQL** | New query file, extract/insert, create schema example |
| **SuiteCloud** | Validate, deploy (optional validate first), upload, create project, account setup, import object/file |
| **SDF / upload workflow** | Open related script object, copy script for manual upload, open script record URL template |
| **AI (local-first)** | Copy sanitized context; Developer Assistant setup in terminal (no API keys stored) |
| **Intelligence** | Add `N/*` import, go to custom field definition, scaffold Jest test |

Right-click in JavaScript for wrap, validate, parameters, 2.1 convert, and SuiteQL extract. Right-click in SuiteQL for insert-as-`N/query`.

SuiteCloud commands require a workspace folder containing `suitecloud.config.js` or `manifest.xml`, and the [SuiteCloud CLI](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_1558708800.html) on your PATH (or set **`netsuite.suitecloudPath`**).

---

## Custom field autocomplete

Copy [`resources/netsuite-fields.example.json`](resources/netsuite-fields.example.json) to **`.vscode/netsuite-fields.json`** in your project and list your account field IDs:

```json
{
  "fields": ["custbody_global_field"],
  "customFields": {
    "customer": ["custentity_my_flag"],
    "salesorder": ["custbody_po_number"]
  }
}
```

While typing `fieldId: '...'`, `sublistFieldId: '...'`, or search `name: '...'`, matching IDs are suggested. When the file references `record.Type.CUSTOMER` (or similar), suggestions prefer fields for that record type.

Change the config path with **`netsuite.customFieldsPath`**. With **`netsuite.sdfFieldDiscovery`** enabled (default), field IDs from SDF custom field objects in your SuiteCloud project are merged automatically.

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `netsuite.defaultApiVersion` | `2.1` | Default API version for generated templates |
| `netsuite.defaultModuleScope` | `SameAccount` | Default module scope for generated templates |
| `netsuite.enableDiagnostics` | `true` | Show SuiteScript validation in JavaScript files |
| `netsuite.enableGovernanceDiagnostics` | `true` | Governance usage hints in JavaScript files |
| `netsuite.customFieldsPath` | `.vscode/netsuite-fields.json` | Custom field ID config for autocomplete |
| `netsuite.sdfFieldDiscovery` | `true` | Merge field IDs from SDF Objects XML |
| `netsuite.suiteqlSchemaPath` | `.vscode/netsuite-suiteql-schema.json` | Optional SuiteQL schema overrides |
| `netsuite.suitecloudPath` | `suitecloud` | SuiteCloud CLI executable for deploy/validate/upload |
| `netsuite.suitecloudValidateBeforeDeploy` | `true` | Run validate before deploy |
| `netsuite.scriptRecordUrlTemplate` | *(empty)* | Browser URL template with `{scriptId}` placeholder |

Search **“netsuite”** in VS Code Settings.

---

## Rate this extension

If **NetSuite – JS Snippets Reload** saves you time, a quick rating on the Visual Studio Marketplace helps other NetSuite developers discover it and supports continued updates.

**[Leave a rating or review on the Marketplace](https://marketplace.visualstudio.com/items?itemName=alexandrejcorrea.ns-js-snippets-reload&ssr=false#review-details)**

Thank you — feedback and reviews are very much appreciated.

---

## Privacy (rating reminder)

The extension may occasionally show a **non-intrusive** prompt asking you to rate it after real use (for example, several JavaScript sessions over time, or a couple of sessions after an update). You can **Rate now**, **Later**, or **Don't ask again**. This uses only VS Code **local extension storage** — no telemetry or external tracking.

---

## Requirements

- Visual Studio Code **1.85+** (language model tools are optional and feature-detected)
- JavaScript files (SuiteScript 2.x) and optional `.suiteql` files

---

## Source and history

- Repository: [github.com/AlexandreD3v/ns-js-snippets_reload](https://github.com/AlexandreD3v/ns-js-snippets_reload)
- Snippet scaffolds were initially generated from [snippetGenerator / JSSnippets](https://github.com/AlexandreD3v/snippetGenerator/tree/JSSnippets/ScriptTypes)

---

## For contributors

Snippets live in `snippets/snippets.code-snippets`. Autocomplete, hover, and diagnostics share JSON under `data/` and providers under `src/`.

**MCP (optional):** set `NS_MCP_WORKSPACE` to your project root, then run `node mcp/server.js` for workspace summary, file context, and SDF script object listing.

Package a VSIX locally:

```powershell
npm install
npm test
node_modules\.bin\vsce.cmd package
```

Install with **Extensions: Install from VSIX…**, or press **F5** to run an Extension Development Host.
