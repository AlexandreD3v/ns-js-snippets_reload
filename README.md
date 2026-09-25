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
| **Diagnostics** | Warnings for missing annotations, wrong entry points, export issues |

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

Turn off in Settings: **`netsuite.enableDiagnostics`**.

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `netsuite.defaultApiVersion` | `2.1` | Default API version for future templates |
| `netsuite.defaultModuleScope` | `SameAccount` | Default module scope for future templates |
| `netsuite.enableDiagnostics` | `true` | Show SuiteScript validation in JavaScript files |

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

- Visual Studio Code **1.62+**
- JavaScript files (SuiteScript 2.x)

---

## Source and history

- Repository: [github.com/AlexandreD3v/ns-js-snippets_reload](https://github.com/AlexandreD3v/ns-js-snippets_reload)
- Snippet scaffolds were initially generated from [snippetGenerator / JSSnippets](https://github.com/AlexandreD3v/snippetGenerator/tree/JSSnippets/ScriptTypes)

---

## For contributors

Snippets live in `snippets/snippets.code-snippets`. Autocomplete, hover, and diagnostics share JSON under `data/` and providers under `src/`.

Package a VSIX locally:

```powershell
npm install
npm test
node_modules\.bin\vsce.cmd package
```

Install with **Extensions: Install from VSIX…**, or press **F5** to run an Extension Development Host.
