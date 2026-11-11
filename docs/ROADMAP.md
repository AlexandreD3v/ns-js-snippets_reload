# Roteiro — SuiteScript Toolkit for NetSuite

Plano dos itens que não são P0. A branch de trabalho é `develop`. O id publicado (`alexandrejcorrea.ns-js-snippets-reload`) e o `name` do `package.json` (`ns-js-snippets-reload`) não mudam. O `displayName` é **SuiteScript Toolkit for NetSuite**.

README e interface ficam em inglês por padrão, com pt-BR ao lado. O público é o dev NetSuite solo e o time interno. Os prefixos de snippet (`map`, `get`, `post` e os demais) não mudam. A extensão continua gratuita, sob GPL-3.0 (`license`: `GPL-3.0-only`), e será publicada no VS Code Marketplace e no Open VSX. Doação é por Pix, mas a página ainda não existe: nenhum arquivo deste repositório pode conter a chave Pix.

O TypeScript passa a viver neste repositório. O repositório irmão [ns-ts-snippets_reload](https://github.com/AlexandreD3v/ns-ts-snippets_reload) será aposentado só depois que os snippets que existem apenas lá estiverem aqui.

## Fora deste roteiro

Os itens P0 estão na branch `p0/deploy-safety` e não entram nestas fases:

- segurança no deploy;
- bugs suspeitos de Deploy, Upload e Extract SuiteQL;
- associação de `.sql`;
- lembrete de avaliação.

Nenhuma fase daqui pode chamar uma conta NetSuite real. `npm test` e `npm run test:integration` continuam obrigatórios.

## Prioridade

| Prioridade | Fase | Estado |
| --- | --- | --- |
| P1 | 1. Preparação da 0.7.1 | feito neste lote |
| P1 | 2. Publicação por tag | bloqueada (secrets e P0) |
| P1 | 3. Localização do manifesto e dos READMEs | próximo lote recomendado |
| P1 | 4. TypeScript, com `vscode.l10n` no código novo | depois da fase 3 |
| P2 | 5. Zero-config e walkthrough | não iniciado |
| P2 | 6. Times | não iniciado |
| P2 | 7. SuiteQL | não iniciado |
| P2 | 8. Autocomplete `N/*` e governança | não iniciado |
| P3 | 9. Doações | bloqueada (página ainda não existe) |

## Fase 1 — Preparação da 0.7.1

Entregue. A versão no `package.json` subiu para `0.7.1`. Não há tag, release nem publicação.

- `displayName`: `SuiteScript Toolkit for NetSuite`.
- Descrição passa a apresentar a extensão como toolkit. Keywords: `netsuite`, `suitescript`, `suiteql`, `sdf`, `suitecloud`, `oracle`, `erp`, `governance`, `javascript`, `snippets`.
- Categorias: `Snippets`, `Programming Languages`, `Linters`. A terceira cabe porque a extensão publica diagnósticos. Não entrou `AI`: as ferramentas de linguagem são opcionais.
- `bugs.url` e `homepage` apontam para o GitHub. O campo `license` já era `GPL-3.0-only` e permanece assim. `GPL-3.0` sem sufixo é um identificador SPDX obsoleto; `GPL-3.0-only` é o id correto para a GPL-3.0 deste repositório.
- `vsce` (pacote antigo, 2.x) saiu das `devDependencies`. No lugar está `@vscode/vsce` `^4.1.0`, que exige Node.js 22. O CI já usa Node 22. O job que só empacota o VSIX (não publica) chama `npx @vscode/vsce` e lê a versão do `package.json`, em vez de gravar `0.7.0` no nome do artefato.
- Os VSIX commitados (`ns-js-snippets-reload-0.1.0.vsix` e `0.1.1.vsix`) saíram do Git. `.gitignore` ignora `*.vsix`.
- O workflow de teste também dispara em `push` e `pull_request` para `develop`. Sem isso, um PR contra `develop` não teria CI.
- O título do README em inglês e o comando de empacotamento acompanham o nome novo e o `@vscode/vsce`. A tradução e o `README.pt-BR.md` ficam na fase 3.

### `.vscodeignore` e a comparação do VSIX

O pacote foi gerado localmente, sem publicar. O “antes” é a árvore `0.7.0` com o `vsce` 2.x e sem `.vscodeignore`. O “depois” é a `0.7.1` com `@vscode/vsce` 4.1.0 e o `.vscodeignore` deste lote.

| | Antes (0.7.0) | Depois (0.7.1) |
| --- | ---: | ---: |
| Tamanho do `.vsix` | 2.078.545 bytes (1,98 MB) | 1.055.413 bytes (1,01 MB) |
| Arquivos dentro do pacote | 566 | 317 |
| Tamanho descompactado | 7.623.523 bytes | 2.503.058 bytes |

A diferença é −1.023.132 bytes (−49%) e −249 arquivos. Saíram 195 source maps, as declarações `.d.ts`, o `.js.flow`, os testes, `.github/`, `scripts/` e `.vscode-test.js`. Os dois VSIX antigos já não entravam no pacote: o `vsce` ignora `**/*.vsix` por padrão. Eles saíram do Git mesmo assim, para o repositório não carregar binário velho.

O que ainda pesa no pacote é runtime: `icon.png` (535.731 bytes) e o JavaScript do Babel, em especial `@babel/parser/lib/index.js` (513.377 bytes). O `@vscode/vsce` continua avisando que o pacote tem 317 arquivos, dos quais 200 são JavaScript. Esse aviso é o Babel, não teste nem mapa.

O ícone publicado não foi recompactado neste lote.

### Por que o esbuild não entrou

O bundling fica para a fase 4, junto com o TypeScript. Motivos:

1. O `main` é `extension.js` em CommonJS. Os testes unitários dão `require` nos módulos de `src/`. Os testes de integração ativam a extensão descompactada. Um bundle só seria coberto se o `main` apontasse para o artefato gerado e o CI compilasse antes de ativar. Hoje não existe passo de build.
2. Há `require` dinâmico. `loadData` faz `require(path.join(dataDir, '...json'))`. `extension.js` e `sdfIndex.js` carregam `suitecloudRunner` dentro de função. O esbuild não segue esses `require`. `data/` e `resources/` precisam continuar no disco: os comandos copiam os exemplos a partir de `extensionPath`.
3. O ganho de tamanho está em `@babel/parser` e `@babel/traverse`. O código usa `require('@babel/traverse').default`. Esses pacotes têm `require` interno dinâmico. Um bundle quebrado derruba governança, migração 2.1 e a edição de `define()`, que é o que o teste de integração não exercita dentro de um arquivo empacotado.
4. A fase 4 vai criar o passo de build de qualquer forma. Empacotar agora e refazer na migração repete o risco. Quando o bundle existir, `vscode` fica externo, `data/` e `resources/` ficam fora do bundle, e um teste precisa ativar o artefato gerado — não só o fonte.

## Fase 2 — Publicação por tag

Não implementar enquanto os secrets não existirem, e não publicar a primeira tag antes do P0 estar em `develop`. A `0.7.1` deste lote é preparação de pacote. Uma tag `v0.7.1` agora publicaria o nome novo junto com os bugs de deploy que a outra branch ainda está corrigindo.

Quando o Alexandre criar os secrets e o P0 tiver entrado em `develop`, o workflow novo (não o de teste) fica em `.github/workflows/release.yml`:

- dispara só em `push` de tags `v*`, nunca em pull request;
- roda os mesmos testes antes de empacotar;
- publica no Marketplace com `npx @vscode/vsce publish`, usando o secret `VSCE_PAT`;
- publica no Open VSX com `npx ovsx publish`, usando o secret `OVSX_PAT` (a dependência `ovsx` entra nessa fase);
- permissão `contents: read`;
- não cria tag nem release a partir do agente.

Os nomes dos secrets são `VSCE_PAT` e `OVSX_PAT`. Quem cria é o dono do publisher. O workflow não deve ser executado só para “ver se passa” sem esses secrets.

## Fase 3 — Localização do manifesto e dos READMEs

Próximo lote recomendado. Não depende de secret, não chama conta NetSuite e não reescreve os arquivos que o P0 está mexendo.

- `package.nls.json` é o inglês padrão. `package.nls.pt-br.json` é o pt-BR (o id de idioma do VS Code é `pt-br`).
- Títulos de comando, descrições, título da configuração e descrições de setting no `package.json` passam a usar chaves `%...%`.
- `README.md` continua em inglês e é a página do Marketplace. Criar `README.pt-BR.md` e apontar um link no README inglês. O Marketplace não troca o README pela locale sozinho.
- Não traduzir prefixos de snippet nem o corpo que é código.

O `vscode.l10n` das mensagens de runtime não entra neste lote. Os providers vão ser reescritos em TypeScript na fase 4; embrulhar as strings agora e de novo na migração é trabalho dobrado. As mensagens de deploy, upload, extract SuiteQL, `.sql` e lembrete de avaliação ficam de fora até o P0 chegar em `develop`, mesmo que alguém antecipe o `l10n`.

Na fase 4, as strings de runtime usam `vscode.l10n.t` e os bundles em `l10n/bundle.l10n.json` (inglês) e `l10n/bundle.l10n.pt-br.json`. O `package.json` aponta `"l10n": "./l10n"`.

## Fase 4 — TypeScript

O objetivo é a extensão analisar e completar `.ts` e `.tsx`, e este repositório passar a ter os snippets que hoje só existem no irmão. Não é um compilador de SuiteScript: o código do usuário continua sendo o fonte que ele edita.

Hoje:

- `activationEvents` só tem `javascript` e `suiteql`;
- completion e hover de SuiteScript registram só `javascript` (`src/providers/completionProvider.js`, `src/providers/hoverProvider.js`);
- diagnósticos aceitam `javascript` e `suiteql` (`SUPPORTED_LANGUAGES` em `src/providers/diagnosticProvider.js`);
- os snippets já estão contribuídos para `typescript` e `typescriptreact`, mas o parser não entende sintaxe TypeScript;
- `@babel/parser` é chamado com `plugins: ['jsx']` na governança e sem plugin nenhum em `importManager.js`, `behaviorRules.js` e `convert.js`.

O que fazer:

- incluir `onLanguage:typescript` e `onLanguage:typescriptreact` na ativação;
- registrar completion, hover e diagnóstico também para `typescript` e `typescriptreact`;
- passar o plugin `typescript` do `@babel/parser` (já vem no pacote; não adicionar `@babel/plugin-transform-typescript`, porque não há passo de emissão de JavaScript);
- trocar a detecção de `define()` que só casa `function (` em `src/utils/parseSuiteScript.js` por leitura do AST, senão arrow function e genérico continuam invisíveis;
- manter os prefixos atuais.

Snippets só do `ns-ts-snippets_reload` (39 prefixos lá, 60 aqui, 18 em comum). Não criar um segundo prefixo que mude apenas a caixa.

Não trazer, porque o prefixo daqui já cobre o mesmo molde: `clientscript`, `userevent`, `mapreduce`, `suitelet`, `lineinit`. `portlet` já existe.

Trazer como prefixo novo: `describe`, `it`, `unit-test-template`, `emptyscript`, `localizationContextEnter`, `localizationContextExit`, `nSearch`, `nSearchCreate`, `nSearchImport`, `portletAnnotation`, `scheduleAnnotation`, `sdfinstallationscript`, `suiteletAnnotation`, `validateDelete`, `validateInsert`.

`schedule` fica para uma olhada antes de entrar: `scheduledscript` já existe e os dois corpos precisam ser comparados para não haver dois scaffolds do mesmo script.

O bundle com esbuild, se ainda compensar depois do `.vscodeignore`, entra nesta fase, com as ressalvas da fase 1. A aposentadoria do repositório irmão é decisão do dono, feita depois desta migração, não por um commit daqui.

## Fase 5 — Zero-config e walkthrough

Para quem trabalha sozinho e não tem projeto SDF. Os defaults já apontam para `.vscode/netsuite-fields.json` e `.vscode/netsuite-suiteql-schema.json`. A status bar some quando não há `suitecloud.config.js` ou `manifest.xml`. Snippet, diagnóstico e SuiteQL já funcionam sem conta.

Adicionar `contributes.walkthroughs` com um percurso que não pede login: abrir um `.js`, inserir o snippet `ClientScript` (prefixo intacto), ver um diagnóstico e, se quiser, gerar o exemplo de campos. Nenhum passo chama o SuiteCloud CLI.

## Fase 6 — Times

- Várias contas e ambientes na status bar. Hoje existe um item só, `$(cloud) NetSuite SDF`, com o comando de validate, oculto sem raiz de projeto (`src/services/statusBar.js`). Não guardar segredo de conta em setting.
- `scope` nas settings. Nenhuma propriedade declara `scope`, então todas valem para a janela. Caminho do SuiteCloud, campos, schema SuiteQL e template de URL do script record devem poder ser `resource` (por pasta). O que é preferência do editor continua na janela.
- Seção **For teams** no `README.md` e o equivalente no `README.pt-BR.md`.
- Severidade de diagnóstico configurável. `toSeverity` em `src/providers/diagnosticProvider.js` fixa error, warning, hint e information. A setting nova não pode esconder, no default, o que a 0.7.1 já mostra.
- Auditoria 2.1 para CI via `npx`. `src/migration/audit.js` já analisa texto sem VS Code e sem rede. Um binário pequeno imprime o relatório e sai com código diferente de zero quando houver item de revisão manual. O teste usa fixture local. Não invocar `suitecloud` nem conta.

## Fase 7 — SuiteQL

- Ampliar tabelas e colunas. `data/suiteql-tables.json` tem 9 tabelas e nenhuma coluna: `customer`, `transaction`, `transactionline`, `item`, `employee`, `vendor`, `account`, `subsidiary`, `customrecord`. Coluna só aparece se o workspace tiver `.vscode/netsuite-suiteql-schema.json`. O catálogo embutido deve ganhar colunas das tabelas que já existem e das próximas tabelas de analytics documentadas pela Oracle. O override do workspace continua ganhando.
- Remover o watcher de schema que não faz nada. Em `extension.js`, o watcher de `**/*netsuite-suiteql-schema.json` registra `onDidChange`, `onDidCreate` e `onDidDelete` com função vazia. `loadSchema` lê o arquivo em toda completion e não tem cache, então o watcher não atualiza nada.
- Não mexer na associação `.sql` nem no Extract SuiteQL. Isso é P0.

## Fase 8 — Autocomplete `N/*` e custos de governança

`data/modules.json` tem 26 módulos. `data/governance.json` tem 12 chaves (`record.load`, `record.save`, `search.create`, `query.runSuiteQL`, `https.get` e outras). O custo só vira diagnóstico quando a chamada está dentro de um loop, mais um aviso para `search.run().each` sem `getRemainingUsage`. Completion e hover não mostram a unidade.

Ampliar o catálogo em direção aos módulos SuiteScript 2.1 que ainda faltam e aos custos das chamadas comuns de record, search, query, file e email que não estão no mapa. Mostrar o custo no detalhe da completion e no hover. Não mudar prefixos.

## Fase 9 — Doações

Bloqueada até existir a página. Quando a URL existir, e só então:

- `SUPPORT.md` com o link da página e o que a doação sustenta;
- `sponsor.url` no `package.json` apontando para essa página;
- `.github/FUNDING.yml` com a mesma URL.

Não inventar URL. Não colocar chave Pix, QR, payload ou “copia e cola” em arquivo nenhum, inclusive nestes três.
