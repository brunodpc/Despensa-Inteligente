# Sprint 07 — Correção do cadastro de produtos na prévia local

## Causa identificada

A aplicação estava sendo executada pelo `DemoApp`, pois o Supabase não estava configurado no ambiente. Nessa rota, `PantryPage` recebia `demo=true` e o botão **Adicionar produto** estava explicitamente desabilitado (`disabled={demo}`). Além disso, `submitProduct` retornava sem feedback quando não havia cliente Supabase ou `householdId`.

## Correção

- O botão de cadastro fica disponível também na prévia local.
- A prévia inclui uma lista local de categorias.
- O formulário valida os campos e grava o produto no `localStorage`.
- O estoque inicial, unidade-base, conversão, localização, validade e custo inicial são preservados.
- O produto novo é adicionado à despensa sem depender de uma conta ou conexão com Supabase.
- A lista automática de reposição é recalculada após o cadastro.
- A interface informa que esses dados ficam somente no navegador atual e não sincronizam com outros dispositivos.
- A dependência `vite-plugin-pwa` fica declarada como `^1.3.0`, mantendo a versão que o usuário já instalou durante a correção de dependências.

## Como testar

1. Inicie `npm.cmd run dev`.
2. Abra `http://localhost:5173/despensa`.
3. Clique em **Adicionar produto**.
4. Cadastre, por exemplo, “Macarrão”, categoria “Grãos e cereais”, unidade-base “g”, unidade de compra “pacote de 500 g”, conversão `500`, estoque mínimo `1`, desejado `3`, estoque inicial `2`.
5. Clique em **Cadastrar produto**.
6. Confirme que o novo produto aparece na tabela com estoque `2 pacotes`.
7. Atualize a página e confirme que o produto continua salvo.

## Limitações conhecidas da prévia

O cadastro é local ao navegador. Não representa uma gravação no Supabase e não é sincronizado com outros moradores. Movimentações, edição e arquivamento de produtos permanecem disponíveis no modo conectado ao Supabase; esta correção trata especificamente o cadastro na prévia local.
