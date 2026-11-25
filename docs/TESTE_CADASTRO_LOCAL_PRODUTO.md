# Teste funcional — Cadastro de produto na prévia local

## Contexto

Ao abrir o projeto sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, a aplicação usa a rota `DemoApp`. Antes desta correção, o botão **Adicionar produto** estava desabilitado com `disabled={demo}` e o formulário dependia exclusivamente do Supabase para persistir o produto.

## Comportamento após a correção

A prévia local permite cadastrar produtos no `localStorage` do navegador atual. O registro mantém:

- nome, categoria, marca e código de barras;
- unidade-base (`g`, `ml` ou `un`);
- apresentação de compra e fator de conversão;
- estoque mínimo e desejado;
- localização e observações;
- quantidade, custo e validade do estoque inicial.

A lista sugerida é recalculada após o cadastro. O produto permanece disponível após atualizar a página, desde que o armazenamento local do navegador esteja habilitado.

## Roteiro de teste manual no Windows

1. Inicie `npm.cmd run dev` e abra `http://localhost:5173/despensa`.
2. Confirme que aparece o aviso **Prévia local interativa**.
3. Clique em **Adicionar produto**.
4. Cadastre:
   - Nome: `Macarrão`
   - Categoria: `Grãos e cereais`
   - Unidade-base: `g`
   - Como compra: `pacote de 500 g`
   - Conversão: `500`
   - Estoque mínimo: `1`
   - Estoque desejado: `3`
   - Estoque inicial: `2`
   - Custo por embalagem: `5,50`
5. Clique em **Cadastrar produto**.
6. Confirme que o item aparece com estoque `2 pacotes` / `1 kg`.
7. Atualize a página e confirme que o item continua aparecendo.
8. Abra a Lista de compras e confira a sugestão de reposição, pois o estoque está acima do mínimo no exemplo. Para testar a sugestão automática, cadastre outro item com estoque inicial `0` e mínimo `1`.

## Limites da prévia

Os dados da prévia são locais ao navegador e não são sincronizados entre pessoas ou dispositivos. O modo conectado ao Supabase continua sendo necessário para residência compartilhada e persistência centralizada. A correção habilita o cadastro local de produtos; edição, arquivamento e movimentações da despensa continuam usando o fluxo conectado ao banco.
