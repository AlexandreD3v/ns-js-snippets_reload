# SuiteScript Toolkit for NetSuite

[English](README.md) · **Português (Brasil)**

**Toolkit de SuiteScript 2.x para o VS Code** — snippets, autocomplete, ajuda ao passar o mouse, SuiteQL, diagnósticos e auxiliares de SDF/SuiteCloud enquanto você escreve JavaScript para NetSuite.

O id no Marketplace continua `alexandrejcorrea.ns-js-snippets-reload`. Com o VS Code em português (Brasil), os títulos de comando e as configurações aparecem em pt-BR. Os prefixos de snippet não mudam.

Funciona em qualquer arquivo `.js`. A extensão ativa quando você edita JavaScript (o módulo AMD típico de SuiteScript 2.x, com `define([...], function () { ... })`).

---

## Por que usar esta extensão?

Customizar o NetSuite no VS Code costuma ser repetir o mesmo esqueleto: cabeçalho JSDoc, dependências do `define()`, entry points de cada tipo de script, searches, checagem de governança e formulários de Suitelet. Esta extensão reduz esse trabalho para você ficar na regra de negócio, em vez de documentação e copia-e-cola.

| Capacidade | O que você recebe |
|------------|-------------------|
| **Snippets** | Modelos completos de script e snippets curtos de entry point e de API |
| **Autocomplete** | Módulos `N/*`, anotações, entry points e enums comuns |
| **Hover** | Explicação curta de módulos, anotações, entry points e enums |
| **Diagnósticos** | Avisos de anotação ausente, entry point errado, export, segurança de SuiteQL e governança |
| **SuiteQL** | Arquivos `.suiteql`, completion de tabela/coluna, extração de `N/query` |
| **Migração 2.1** | Auditoria do workspace e conversão com prévia para `@NApiVersion 2.1` |
| **SDF / SuiteCloud** | Comandos da CLI, detecção de projeto e navegação até o objeto de script |

---

## Snippets

### Modelos completos de script

Digite o prefixo e aceite a sugestão (Tab) para inserir um arquivo inicial:

- **Client Script** — `ClientScript`, `ClientScriptHelloWorld`, `ClientScriptNSSample`
- **User Event** — `UserEvent`, `UserEventHelloWorld`, `UserEventNsSample`
- **Suitelet** — `Suitelet`, `SuiteletHelloWorld`, `SuiteletNSSampleForm`
- **RESTlet** — `RESTlet`, `RESTletHelloWorld`, `RESTletNsSample`
- **Map/Reduce** — `MapReduce`, `MapReduceNSSample`
- **Outros tipos** — `scheduledscript`, `massupdatescript`, `portlet`, `workflowactionscript`, `bundleinstallationscript`

### Snippets de entry point

Handlers individuais quando o script já tem a casca, por exemplo:

`pageInit`, `fieldChanged`, `validateField`, `saveRecord`, `beforeLoad`, `beforeSubmit`, `afterSubmit`, `onRequest`, `get`, `post`, `put`, `_delete`, `getInputData`, `map`, `reduce`, `summarize`, `execute`, `onAction` e outros.

### Snippets de padrão (API do dia a dia)

| Prefixo | Insere |
|--------|---------|
| `define` | Invólucro AMD `define([...], function () { ... })` |
| `nsSearch` | `search.create` com filtros e colunas |
| `nsSearchRun` | Laço `search.run().each()` |
| `nsSearchGovernance` | Laço de search com guarda de governança |
| `nsSublist` | Iteração de linha de sublista |
| `nsParam` | Leitura de parâmetro de deployment |
| `nsTryCatch` | try/catch com `N/log` e `N/error` |
| `nsGovernance` | Checagem de `getRemainingUsage()` |
| `nsSuiteletForm` | Formulário mínimo de Suitelet com um campo |
| `nsSuiteQL` | Modelo de `query.runSuiteQL` |
| `nsDeployParam` | Bloco de documentação de parâmetro de script |
| `nsRecordLoad` | `record.load` por tipo e ID |
| `nsRecordSubmit` | `setValue` + `save` |
| `nRecordSamples` | Exemplos de uso de `N/record` |

Amostras no estilo da documentação do NetSuite (formulários, contagem de palavras em Map/Reduce etc.) entram para estudo e adaptação.

---

## Autocomplete

As sugestões aparecem enquanto você digita em arquivos JavaScript (disparo em `/`, `@`, `.` e aspas).

### Módulos `N/*` (26 módulos)

Dentro de `define([...])` ou ao digitar um caminho de módulo, por exemplo:

`N/record`, `N/search`, `N/log`, `N/runtime`, `N/query`, `N/https`, `N/ui/serverWidget`, `N/file`, `N/email`, `N/format` e outros.

### Anotações SuiteScript

No JSDoc ou ao digitar `@`:

- `@NApiVersion 2.x` / `2.1`
- `@NModuleScope SameAccount` / `Public`
- `@NScriptType` para Client Script, User Event, Suitelet, RESTlet, Map/Reduce, Scheduled, Mass Update, Portlet, Workflow Action e Bundle Installation
- `@NAmdConfigPath`

### Entry points conforme o arquivo

A extensão lê o `@NScriptType` e sugere **só os entry points que ainda não estão implementados** — por exemplo `pageInit`, `fieldChanged` e `saveRecord` num Client Script, ou `onRequest` num Suitelet com ramos GET/POST.

### Enums e formas comuns de API

Depois de importar os módulos e usar o alias AMD:

- `record.Type.*` (por exemplo `SALES_ORDER`, `CUSTOMER`, `INVOICE`)
- `search.Type.*` e `search.Operator.*`
- `serverWidget.FieldType.*`
- `log.debug`, `log.audit`, `log.error`, `log.emergency`
- `runtime.getCurrentScript().getParameter()`, `getRemainingUsage()`

---

## Documentação no hover

Passe o mouse sobre:

- nomes de módulo em `define([...])`
- `@NScriptType` e anotações relacionadas
- nomes de entry point (`beforeSubmit`, `onRequest`, …)
- valores de enum comuns quando usados com o alias importado

A descrição curta aparece sem sair do editor.

---

## Diagnósticos

Checagens opcionais de SuiteScript em arquivos `.js` (ligadas por padrão):

- `@NApiVersion` ausente quando o arquivo usa `define(...)`
- `@NScriptType` ausente ou inconsistente
- entry points que não batem com o tipo de script declarado
- funções de entry point definidas e não exportadas no `return { }`
- aviso quando arrow functions no `return { }` pedem `@NApiVersion 2.1` em vez de `2.0`

Desligue em Configurações: **`netsuite.enableDiagnostics`**. Os avisos de governança usam **`netsuite.enableGovernanceDiagnostics`**.

Avisos de SuiteQL aparecem dentro de template literals de `query.runSuiteQL` e em arquivos `.suiteql`.

---

## Migração para SuiteScript 2.1

- **NetSuite: Auditar o workspace para SuiteScript 2.1** — relatório em markdown das versões de API e dos itens para revisão manual.
- **NetSuite: Converter o script atual para 2.1 (prévia)** — diff do arquivo atual contra o texto convertido. Nada é gravado até você escolher Aplicar.
- **NetSuite: Converter os scripts do workspace para 2.1** — converte só módulos SuiteScript (arquivos como `suitecloud.config.js` são ignorados), salva o resultado e mostra um resumo.

A conversão atualiza `@NApiVersion` para **2.1** e moderniza padrões simples `return { handler: function () {} }` para arrow functions quando isso é seguro. Padrões sensíveis a comportamento ficam marcados para revisão manual (a Oracle não publicou um prazo verificado de “só 2.1”; trate 2.1 como o padrão recomendado).

---

## Bancada de SuiteQL

- Abra ou crie arquivos **`.suiteql`** (a associação opcional com `.sql` existe) com realce básico de sintaxe.
- A completion usa o catálogo embutido mais os [overrides de schema](resources/netsuite-suiteql-schema.example.json) opcionais em **`netsuite.suiteqlSchemaPath`**.
- **Extrair SuiteQL do JavaScript** / **Inserir SuiteQL como bloco N/query** no menu de contexto do editor. A inserção a partir de um `.suiteql` grava o bloco JavaScript num editor JavaScript aberto, ou num documento JavaScript novo. `$`, crases e `${...}` na consulta permanecem como texto.

---

## Comandos

Abra a paleta de comandos e busque **NetSuite** (agrupados por área). Os títulos abaixo são os do VS Code em português (Brasil):

| Área | Exemplos |
|------|----------|
| **Scripts** | Novo modelo, bloco de parâmetros, envolver em `define()`, validar arquivo |
| **Campos** | Recarregar campos customizados, criar configuração de exemplo |
| **2.1** | Auditar o workspace, converter o arquivo atual ou o workspace |
| **SuiteQL** | Novo arquivo de consulta, extrair/inserir, criar exemplo de schema |
| **SuiteCloud** | Validar, deploy (com validação antes, se estiver ligada), enviar arquivo, criar projeto, configurar conta, importar objeto/arquivo |
| **SDF / envio manual** | Abrir o objeto de script relacionado, copiar o script para envio manual, abrir a URL do registro do script |
| **IA (local primeiro)** | Copiar contexto sem segredos; configurar o Developer Assistant no terminal (nenhuma chave de API é guardada) |
| **Inteligência** | Adicionar import `N/*`, ir à definição do campo customizado, criar teste Jest |

Clique com o botão direito no JavaScript para envolver, validar, parâmetros, converter para 2.1 e extrair SuiteQL. Clique com o botão direito no SuiteQL para inserir como `N/query`.

Os comandos SuiteCloud exigem uma pasta de workspace com `suitecloud.config.js` ou `manifest.xml`, e a [SuiteCloud CLI](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_1558708800.html) no PATH (ou **`netsuite.suitecloudPath`**).

**Configurar conta**, **criar projeto** e **importar arquivo** rodam no terminal integrado para você responder aos prompts da SuiteCloud. Validar, deploy e enviar arquivo ficam no canal de saída, com notificação que pode ser cancelada.

---

## Autocomplete de campos customizados

Copie [`resources/netsuite-fields.example.json`](resources/netsuite-fields.example.json) para **`.vscode/netsuite-fields.json`** no projeto e liste os IDs de campo da conta:

```json
{
  "fields": ["custbody_global_field"],
  "customFields": {
    "customer": ["custentity_my_flag"],
    "salesorder": ["custbody_po_number"]
  }
}
```

Ao digitar `fieldId: '...'`, `sublistFieldId: '...'` ou `name: '...'` numa search, os IDs correspondentes são sugeridos. Quando o arquivo cita `record.Type.CUSTOMER` (ou equivalente), as sugestões preferem os campos daquele tipo de registro.

Mude o caminho com **`netsuite.customFieldsPath`**. Com **`netsuite.sdfFieldDiscovery`** ligado (padrão), os IDs de campos customizados dos objetos SDF do projeto SuiteCloud entram automaticamente.

---

## Configurações

| Setting | Padrão | Descrição |
|---------|---------|-------------|
| `netsuite.defaultApiVersion` | `2.1` | Versão de API padrão dos modelos gerados |
| `netsuite.defaultModuleScope` | `SameAccount` | Escopo de módulo padrão dos modelos gerados |
| `netsuite.enableDiagnostics` | `true` | Validação SuiteScript em arquivos JavaScript |
| `netsuite.enableGovernanceDiagnostics` | `true` | Avisos de governança em arquivos JavaScript |
| `netsuite.customFieldsPath` | `.vscode/netsuite-fields.json` | JSON de IDs de campo para o autocomplete |
| `netsuite.sdfFieldDiscovery` | `true` | Incluir IDs vindos do XML de Objects do SDF |
| `netsuite.suiteqlSchemaPath` | `.vscode/netsuite-suiteql-schema.json` | Overrides opcionais de schema SuiteQL |
| `netsuite.suitecloudPath` | `suitecloud` | Executável da SuiteCloud CLI para deploy/validação/envio |
| `netsuite.suitecloudValidateBeforeDeploy` | `true` | Rodar validate antes do deploy |
| `netsuite.scriptRecordUrlTemplate` | *(vazio)* | Modelo de URL do navegador com o marcador `{scriptId}` (`{id}` também vale) |
| `netsuite.debugRatingPrompt` | `false` | Mostrar **NetSuite: Pré-visualizar lembrete de avaliação**. A prévia não altera a escolha já salva |

Busque **“netsuite”** nas Configurações do VS Code.

---

## Avalie esta extensão

Se o **SuiteScript Toolkit for NetSuite** economiza o seu tempo, uma avaliação rápida no Visual Studio Marketplace ajuda outros desenvolvedores NetSuite a encontrarem a extensão e sustenta as próximas atualizações.

**[Deixe uma avaliação ou resenha no Marketplace](https://marketplace.visualstudio.com/items?itemName=alexandrejcorrea.ns-js-snippets-reload&ssr=false#review-details)**

Obrigado — feedback e resenhas são muito bem-vindos.

---

## Privacidade (lembrete de avaliação)

A extensão pode mostrar um lembrete depois de uso real (cerca de sete dias e várias sessões). Escolher **Avaliar agora**, **Mais tarde** ou **Não perguntar de novo** — ou fechar a notificação — só é gravado depois que a notificação fecha. Essa escolha vale para a versão major atual, então atualizações de patch e minor não perguntam de novo. Uma major posterior pode perguntar depois de algumas sessões. Para ver a notificação sem gravar essa escolha, ligue **`netsuite.debugRatingPrompt`** e rode **NetSuite: Pré-visualizar lembrete de avaliação**. Isso usa só o **armazenamento local da extensão** no VS Code — sem telemetria e sem rastreamento externo.

---

## Requisitos

- Visual Studio Code **1.85+**. As quatro ferramentas locais de modelo de linguagem estão em `package.json` e se registram quando o VS Code 1.95+ oferece `vscode.lm.registerTool`.
- Arquivos JavaScript (SuiteScript 2.x) e, se quiser, arquivos `.suiteql`

---

## Fonte e histórico

- Repositório: [github.com/AlexandreD3v/ns-js-snippets_reload](https://github.com/AlexandreD3v/ns-js-snippets_reload)
- Os modelos de snippet nasceram de [snippetGenerator / JSSnippets](https://github.com/AlexandreD3v/snippetGenerator/tree/JSSnippets/ScriptTypes)

---

## Para quem contribui

Os snippets ficam em `snippets/snippets.code-snippets`. Autocomplete, hover e diagnósticos compartilham o JSON em `data/` e os providers em `src/`. O stub opcional de MCP está em `mcp/server.js`. O plano interno está em `docs/ROADMAP.md`.

Empacote um VSIX localmente (Node.js 22+, `@vscode/vsce`):

```powershell
npm install
npm test
npx @vscode/vsce package
```

Instale com **Extensões: Instalar a partir do VSIX…**, ou pressione **F5** para abrir um Extension Development Host.
