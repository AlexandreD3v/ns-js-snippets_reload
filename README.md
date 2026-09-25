# ns-js-snippets_reload

VS Code extension for NetSuite SuiteScript development with JavaScript snippets and contextual autocomplete.

Snippet generation started from:
https://github.com/AlexandreD3v/snippetGenerator/tree/JSSnippets/ScriptTypes

## What the extension provides

### Snippets
- Full script scaffolds for `ClientScript`, `UserEvent`, `Suitelet`, `RESTlet`, `MapReduce`, `ScheduledScript`, `MassUpdateScript`, `Portlet`, `WorkflowActionScript`, and `BundleInstallationScript`
- Smaller helper snippets for common entry points and utility structures such as `define`
- Example snippets inspired by NetSuite documentation

### Autocomplete
- `N/*` module suggestions while typing inside `define([...])` or a module string
- SuiteScript annotation suggestions such as `@NApiVersion`, `@NModuleScope`, and `@NScriptType`
- Contextual entry point suggestions based on the detected `@NScriptType`
- Entry points are only suggested when they are not already implemented in the current file

## Featured snippets

### ClientScript
- `ClientScript`
- `ClientScriptHelloWorld`
- `ClientScriptNSSample`
- `pageInit`
- `validateField`
- `fieldChanged`
- `postSourcing`
- `lineInit`
- `validateLine`
- `sublistChanged`
- `saveRecord`

### UserEvent
- `UserEvent`
- `UserEventHelloWorld`
- `UserEventNsSample`
- `beforeLoad`
- `beforeSubmit`
- `afterSubmit`

### Suitelet
- `Suitelet`
- `SuiteletHelloWorld`
- `SuiteletNSSampleForm`
- `onRequest`

### MapReduce
- `MapReduce`
- `MapReduceNSSample`
- `getInputData`
- `map`
- `reduce`
- `summarize`

### RESTlet
- `RESTlet`
- `RESTletHelloWorld`
- `RESTletNsSample`
- `get`
- `post`
- `put`
- `_delete`

### Other script types
- `scheduledscript`
- `massupdatescript`
- `portlet`
- `workflowactionscript`
- `bundleinstallationscript`

### General helpers
- `define`
- `nRecordSamples`

## Development notes

- Snippets are declared in `snippets/snippets.code-snippets`
- Autocomplete is implemented in `extension.js`
- Extension metadata lives in `package.json`

## Packaging

Generate a VSIX package with:

```powershell
node_modules\.bin\vsce.cmd package
```
