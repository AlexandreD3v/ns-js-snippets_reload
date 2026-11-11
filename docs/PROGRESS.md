# Progresso

Registro do que avançou na branch `develop`. O P0 (deploy, upload, extract SuiteQL, `.sql` e lembrete de avaliação) está em `p0/deploy-safety` e não aparece aqui.

## develop

| Data | Item | Status | PR |
| --- | --- | --- | --- |
| 2026-11-11 | Plano dos itens não-P0 em `docs/ROADMAP.md` | feito | este PR |
| 2026-11-11 | Preparação da 0.7.1: displayName, descrição, keywords, categorias, `bugs`, `homepage`, `license` mantida em `GPL-3.0-only` | feito | este PR |
| 2026-11-11 | `.vscodeignore`, remoção dos VSIX commitados, `*.vsix` no `.gitignore`, troca de `vsce` por `@vscode/vsce` | feito | este PR |
| 2026-11-11 | Bundling com esbuild | adiado; análise na fase 1 do roteiro. VSIX de 2.078.545 bytes / 566 arquivos para 1.055.413 bytes / 317 arquivos | este PR |
| 2026-11-11 | CI de teste também em `develop`, sem workflow de publicação | feito | este PR |
| — | Publicação por tag (Marketplace e Open VSX) | não iniciado; depende de `VSCE_PAT`, `OVSX_PAT` e do P0 em `develop` | — |
| — | Localização (`package.nls.json`, `package.nls.pt-br.json`, `README.pt-BR.md`) | não iniciado; próximo lote recomendado | — |
| — | TypeScript (ativação, providers, plugin `typescript` do Babel, snippets do repositório irmão) e `vscode.l10n` | não iniciado | — |
| — | Zero-config e walkthrough | não iniciado | — |
| — | Times: contas na status bar, `scope`, seção For teams, severidade, `npx` da auditoria 2.1 | não iniciado | — |
| — | SuiteQL: catálogo e remoção do watcher sem efeito | não iniciado | — |
| — | Autocomplete `N/*` e custos de governança | não iniciado | — |
| — | Doações (`SUPPORT.md`, `sponsor.url`, `FUNDING.yml`) | bloqueado; a página não existe e a chave Pix não entra em arquivo | — |
