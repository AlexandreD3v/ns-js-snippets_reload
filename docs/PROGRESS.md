# Progresso

## P0 – branch p0/deploy-safety

Investigação do auth ID: o SuiteCloud CLI para Node.js grava o alias da conta do projeto em `project.json`, na raiz do projeto (ao lado de `suitecloud.config.js`), no campo `defaultAuthId`. Esse alias é escolhido em `account:setup` / `account:setup:ci`. O ID real da conta, o papel e os tokens ficam no arquivo cifrado `~/.suitecloud-sdk/credentials_browser_based.p12` ou `credentials_ci.p12` e não são lidos pela extensão.

A hipótese do sufixo foi conferida na documentação da NetSuite. Conta de sandbox: o ID de produção acrescido de `_SB1`, `_SB2`, … (também existe `_SB`). Release preview: `_RP`. Na URL o mesmo ID aparece com hífen e minúsculas (`1234567-sb1`, `1234567-rp`). Como o `defaultAuthId` é só um alias, a extensão aplica essas marcas ao alias. Um sufixo de sandbox ou release preview ganha de uma palavra como `prod` (`prod_SB1` é sandbox). ID numérico sem sufixo, `TSTDRV` + dígitos, ou os nomes `prod`, `production`, `live` e `prd` parecem produção. `dev`, `qa`, `uat`, `staging` e `non-prod` parecem não produção. Qualquer outro alias fica como desconhecido.

Nenhum teste chama uma conta NetSuite. A suíte de integração continua usando `test/integration/fixtures/fake-suitecloud.js`.

### A1 — Confirmação de conta no Deploy e no Upload

- Status: **feito**
- O que mudou: antes de Deploy e Upload a extensão exige o CLI, lê `defaultAuthId` e abre um diálogo modal com a conta. Produção usa o botão `Deploy to production` ou `Upload to production` e o texto diz que a conta live será alterada. Sandbox, release preview e nomes não produtivos usam o botão normal. Com `netsuite.suitecloudAlwaysConfirmAccount` desligada (o padrão é ligada), esses ambientes não produtivos seguem sem diálogo. Produção e auth ID ausente ou ilegível continuam pedindo confirmação. A extensão não descriptografa credenciais e não envia o auth ID na linha de comando: o CLI continua lendo o `project.json`.
- Como testar manualmente:
  1. Num projeto SDF, confira `project.json` com `"defaultAuthId": "1234567_SB1"`.
  2. Rode **NetSuite: SuiteCloud Deploy Project**. O modal deve citar `1234567_SB1 (sandbox)`. Cancelar não pode chamar o deploy.
  3. Troque o auth ID para `acme_prod` ou para um ID numérico sem sufixo. O modal deve dizer `PRODUCTION` e o botão deve ser `Deploy to production`.
  4. Desligue `netsuite.suitecloudAlwaysConfirmAccount`. Um auth ID sandbox não deve mais perguntar. Um auth ID de produção ainda deve perguntar.
  5. Repita com **NetSuite: SuiteCloud Upload File** num arquivo dentro de `FileCabinet`.

### Deploy sem CLI mostrava "Validation failed. Deploy anyway?"

- Status: **feito**
- O que mudou: CLI ausente ou saída negativa (o processo nem chegou a validar) interrompe o Deploy. O aviso continua sendo o de CLI não encontrado. "Validation failed. Deploy anyway?" só aparece quando o `project:validate` realmente termina com código de erro maior que zero.
- Como testar manualmente: aponte `netsuite.suitecloudPath` para um executável que não existe e rode o Deploy. A mensagem deve citar o caminho ausente e não pode falar em validação.

### Upload Active File — `--paths` sem barra e saída sem editor

- Status: **feito** na barra inicial. A saída sem editor **não era bug** no código desta branch.
- O que mudou: `file:upload --paths` agora recebe o caminho do File Cabinet com `/` na frente, como a documentação do SuiteCloud CLI exige (`/SuiteScripts/hello.js`, não `SuiteScripts/hello.js`). Sem editor, o comando já mostrava `Open a file inside the project FileCabinet folder.` e retornava. Isso está coberto pelo teste de integração dos comandos sem arquivo aberto. Não havia caminho silencioso.
- Como testar manualmente: abra um script em `FileCabinet/SuiteScripts`, rode o Upload e confira no output `file:upload --paths /SuiteScripts/...`. Feche todos os editores e rode de novo: deve aparecer o aviso para abrir um arquivo, sem chamada ao CLI.

### Extract SuiteQL to File só achava `query: \`...\``

- Status: **feito**
- O que mudou: se houver seleção, ela é o texto extraído (template literal com crases em volta é desembrulhado). Sem seleção, a extensão pega um template literal que contém `SELECT`, mesmo fora de `query:`. O cursor escolhe qual literal, quando há mais de um. O formato antigo `query: \`...\`` continua valendo quando não existe um `SELECT`.
- Como testar manualmente:
  1. Num `.js`, escreva `` const query = `SELECT id FROM vendor`; `` sem a propriedade `query:`. Rode **NetSuite: Extract SuiteQL from JavaScript**. O arquivo gerado deve conter esse `SELECT`.
  2. Selecione outro `SELECT` no mesmo arquivo e extraia de novo. O resultado deve ser a seleção, não o primeiro literal.

### Linguagem SuiteQL em qualquer `.sql`

- Status: **feito**
- O que mudou: `.sql` saiu de `contributes.languages`. `.suiteql` continua SuiteQL. A setting `netsuite.suiteqlAssociateSqlFiles` (padrão desligada) passa a tratar `.sql` como SuiteQL enquanto a extensão está ativa, e desfaz essa troca ao ser desligada. A extensão não regrava `files.associations`.
- Como testar manualmente: abra um `notas.sql`. A linguagem não deve ser SuiteQL. Ligue a setting, e o arquivo aberto deve passar a SuiteQL. Desligue, e ele deve sair de SuiteQL. Um `.suiteql` permanece SuiteQL nos dois casos.

### Lembrete de avaliação

- Status: **feito**. O comportamento depois do PR #8 não estava ok para notificação ignorada.
- O que mudou: o PR #8 passou a gravar a versão maior só depois que o diálogo resolve, e ignora um valor antigo com ponto (`0.7.0`) gravado antes da resposta. Isso corrige o travamento quando a notificação quebrava no meio. Fechar o aviso sem clicar ainda gravava a versão maior, e `shouldPromptForRating` tratava isso como "já perguntado nesta versão". Agora só **Rate now**, **Later** e **Don't ask again** gravam a versão. Fechar o aviso apenas adia (`snoozedUntil`, 14 dias) e a mesma versão pode perguntar de novo depois do adiamento.
- Como testar manualmente: com os dados locais de uma instalação já elegível, feche o lembrete no X. A preferência de "já avaliou / não perguntar / versão já promptada" não deve ficar marcada. **Later** continua valendo para a versão maior. O comando **NetSuite: Preview Rating Reminder** (setting `netsuite.debugRatingPrompt`) segue sem gravar a resposta.

## Como rodar os testes

```bash
npm test
npm run test:integration
```

Os testes de integração sobem o VS Code com a CLI falsa. Não há chamada de rede para a NetSuite.
