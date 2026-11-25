# Correções da Sprint 06 — TypeScript e instalação

Esta revisão corrige os cinco erros de TypeScript reportados durante `npm.cmd run typecheck` e `npm.cmd run build`.

## Correções aplicadas

- `MarketModePage.tsx`: valida `listResult.data` antes de acessar `budget`; se a lista ativa não existir, apresenta uma mensagem de erro e encerra o carregamento.
- `MarketModePage.tsx`: remove a variável `conversion` que não era utilizada no render do carrinho.
- `ShoppingPage.tsx`: inclui `brand` no tipo do produto e no `select` do Supabase. A coluna `brand` já existe na tabela `products` da migration inicial.
- `package.json`: aprova somente o script de instalação do `esbuild@0.28.2`, usado pela cadeia de build Vite. A aprovação está limitada à versão observada, não a todos os pacotes.

## Como atualizar no Windows

1. Extraia o ZIP corrigido em uma pasta nova, por exemplo `C:\Projetos\despensa-inteligente-sprint06-corrigida`.
2. Abra no VS Code a pasta que contém diretamente o `package.json`.
3. Copie o seu `.env.local` anterior para essa pasta somente se já tiver configurado o Supabase.
4. No terminal PowerShell, execute:

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd run build
```

5. Se typecheck e build terminarem sem erros, execute `npm.cmd run dev`.

Se o npm continuar listando `esbuild@0.28.2` como script não aprovado, dentro da pasta do projeto execute `npm.cmd install-scripts ls` para revisar e depois `npm.cmd install-scripts approve esbuild`. Esse comando registra a aprovação no `package.json`; não use `approve --all`. A documentação do npm descreve esse mecanismo como controle explícito dos scripts de instalação das dependências.

## Observação sobre `npm audit`

O aviso de auditoria é separado dos erros de TypeScript. Execute `npm.cmd audit` para ver o relatório completo. Não execute `npm audit fix --force` sem revisar as vulnerabilidades e as mudanças de versões propostas.
