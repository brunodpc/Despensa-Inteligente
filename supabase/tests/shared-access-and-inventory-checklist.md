# Testes de acesso compartilhado e estoque

## Preparação

- Criar uma residência de teste com a Conta A (owner).
- Convidar a Conta B como `member` e aceitar o convite.
- Criar uma residência separada com a Conta C (owner).
- Aplicar as migrations `001`, `002` e `003` em sequência.

## Permissões compartilhadas (A e B)

- [ ] A cadastra um produto com estoque inicial; B enxerga o produto e o saldo.
- [ ] B edita nome, categoria, marca, unidade de compra e níveis mínimo/desejado; A enxerga a edição.
- [ ] B registra uma entrada com custo e validade; A enxerga o novo lote e saldo consolidado.
- [ ] A registra consumo parcial; B enxerga o saldo atualizado e o movimento.
- [ ] B registra consumo de vários lotes; a baixa consome FEFO (menor validade primeiro).
- [ ] B tenta consumir mais que o saldo: RPC deve rejeitar e preservar todos os lotes.
- [ ] A arquiva um produto; B deixa de vê-lo na lista ativa, mas os registros históricos permanecem.
- [ ] A e B criam, atualizam e removem itens de uma lista compartilhada.
- [ ] A e B registram compras e preços na mesma residência.
- [ ] A e B conseguem importar e revisar registros de notas fiscais.

## Isolamento (Conta C)

- [ ] C não consulta produtos de A/B.
- [ ] C não consulta lotes ou movimentações de A/B.
- [ ] C não consulta nem altera listas, compras, preços ou importações de A/B.
- [ ] Escrita com `household_id` da residência de A/B é recusada por RLS/RPC.

## Administração

- [ ] B, no papel `member`, não consegue criar convite.
- [ ] B, no papel `member`, não consegue revogar convite.
- [ ] A, no papel `owner`, consegue criar, listar e revogar convites.

## Concorrência

- [ ] Com saldo de 1 unidade-base, executar duas baixas concorrentes de 1 unidade-base: no máximo uma deve confirmar.
- [ ] Saldo consolidado nunca pode ficar negativo.
- [ ] Toda baixa confirmada deve ter um ou mais registros correspondentes em `stock_movements`.

## Evidência

Registrar os IDs dos usuários e da residência de teste, horário de cada execução, resultado esperado/observado e erros retornados. Não usar dados reais da residência doméstica para testes de isolamento.
