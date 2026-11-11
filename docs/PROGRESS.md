# Progresso

Registro do que avançou na branch `develop`. O P0 (deploy, upload, extract SuiteQL, `.sql` e lembrete de avaliação) está em `p0/deploy-safety` e não aparece aqui.

## develop

| Data | Item | Status | PR |
| --- | --- | --- | --- |
| 2026-11-11 | Plano dos itens não-P0 em `docs/ROADMAP.md` | feito | [#12](https://github.com/AlexandreD3v/ns-js-snippets_reload/pull/12) |
| 2026-11-11 | Preparação da 0.7.1: displayName, descrição, keywords, categorias, `bugs`, `homepage`, `license` mantida em `GPL-3.0-only` | feito | [#12](https://github.com/AlexandreD3v/ns-js-snippets_reload/pull/12) |
| 2026-11-11 | `.vscodeignore`, remoção dos VSIX commitados, `*.vsix` no `.gitignore`, troca de `vsce` por `@vscode/vsce` | feito | [#12](https://github.com/AlexandreD3v/ns-js-snippets_reload/pull/12) |
| 2026-11-11 | Bundling com esbuild | adiado; análise na fase 1 do roteiro. VSIX de 2.078.545 bytes / 566 arquivos para 1.055.413 bytes / 317 arquivos | [#12](https://github.com/AlexandreD3v/ns-js-snippets_reload/pull/12) |
| 2026-11-11 | CI de teste também em `develop`, sem workflow de publicação | feito | [#12](https://github.com/AlexandreD3v/ns-js-snippets_reload/pull/12) |
| — | Publicação por tag (Marketplace e Open VSX) | não iniciado; depende de `VSCE_PAT`, `OVSX_PAT` e do P0 em `develop` | — |
| 2026-11-11 | Localização do manifesto (`package.nls.json`, `package.nls.pt-br.json`) e `README.pt-BR.md`. `vscode.l10n` de runtime ficou para a fase de TypeScript | feito | [#13](https://github.com/AlexandreD3v/ns-js-snippets_reload/pull/13) |
| — | TypeScript (ativação, providers, plugin `typescript` do Babel, snippets do repositório irmão) e `vscode.l10n` | não iniciado | — |
| — | Zero-config e walkthrough | não iniciado | — |
| — | Times: contas na status bar, `scope`, seção For teams, severidade, `npx` da auditoria 2.1 | não iniciado | — |
| — | SuiteQL: catálogo e remoção do watcher sem efeito | não iniciado | — |
| — | Autocomplete `N/*` e custos de governança | não iniciado | — |
| — | Doações (`SUPPORT.md`, `sponsor.url`, `FUNDING.yml`) | bloqueado; a página não existe e a chave Pix não entra em arquivo | — |
