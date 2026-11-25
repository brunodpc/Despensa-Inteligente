# Sprint 06 — Lista, compras, modo mercado, preços e relatórios

## Escopo entregue

- **Lista de compras:** lista ativa por residência, inclusão de produtos do catálogo e itens avulsos, ajuste de quantidade, remoção, marcação de itens separados e orçamento.
- **Reposição automática:** a migration `202611240004_shopping_purchases_prices.sql` cria uma função que mantém os itens em estoque baixo na lista ativa. Triggers recalculam a lista após movimentos de estoque e alterações nas regras mínimo/desejado.
- **Registrar compra:** cadastro manual de mercado, data, linhas de produtos, quantidade em embalagens, preço por embalagem, desconto e validade por lote. A página aceita anexo de imagem ou PDF da nota. O arquivo é armazenado em bucket privado e vinculado ao registro de compra.
- **Confirmação transacional:** `confirm_household_purchase` cria a compra, itens, lotes, movimentos de entrada e histórico de preço na mesma transação. Usa `client_request_id` para idempotência.
- **Código de barras:** campo de leitura/digitação EAN/GTIN compatível com scanner USB/Bluetooth que atua como teclado. O código precisa estar cadastrado no catálogo. Integração de câmera nativa ainda não faz parte desta sprint.
- **Modo mercado:** marca itens que estão no carrinho, permite alterar quantidade e preço por embalagem, calcula subtotal e saldo em relação ao orçamento.
- **Histórico de preços:** consulta registros de compras confirmadas e permite registrar preços observados manualmente por mercado.
- **Relatórios:** indicadores dos últimos seis meses, gastos mensais, gastos por categoria, produtos com maior gasto, ticket médio e perdas separadas por unidade (`g`, `ml`, `un`).
- **Dashboard demonstrativo integrado:** indicadores, reposição sugerida, compras do mês e lista pendente passam a refletir os dados locais alterados nos módulos.

## Convenções de unidades e valores

- `products.base_unit` é a unidade-base (`g`, `ml`, `un`).
- `products.base_quantity_per_purchase_unit` representa a conversão de uma embalagem para a unidade-base.
- `shopping_list_items.requested_quantity`, `shopping_list_items.estimated_unit_price` e `price_history.unit_price` são persistidos na unidade-base.
- A interface apresenta quantidades e preços por embalagem para facilitar o uso no mercado.
- `purchase_items.quantity` é persistido na unidade-base; `unit_price` é o custo por unidade-base (8 casas decimais para evitar distorção na conversão) e `total_price` é o total da linha em BRL.
- Relatórios tratam compras com status `confirmed`. Categorias e ranking de produtos usam os valores das linhas antes de eventual desconto global da compra; o total mensal usa o total líquido confirmado da compra. Perdas são apresentadas separadas por unidade-base (`g`, `ml`, `un`) e não estimam valor financeiro.

## Demonstração local

Quando o Supabase não está configurado, os cinco módulos usam `localStorage` no navegador. Compras atualizam o estoque demonstrativo, preços e relatórios no mesmo navegador. Esses dados não são sincronizados entre computadores ou moradores e não são dados reais da residência.

## Configuração do Supabase

Aplicar a migration `202611240004_shopping_purchases_prices.sql` após as migrations 001, 002 e 003. Ela:

1. adiciona `client_request_id`, índice de idempotência concorrente em `purchases` e precisão de oito casas para custos/preços normalizados (incluindo preço estimado da lista); 
2. garante uma lista ativa por residência e evita duplicidade de produto em uma lista;
3. cria `sync_low_stock_shopping_list` e triggers para sincronização automática;
4. cria `confirm_household_purchase` para confirmar compra e atualizar estoque/preços atomicamente;
5. cria o bucket privado `purchase-receipts` e políticas de Storage isoladas por residência.

A migration usa `storage.buckets` e `storage.objects`, portanto deve ser executada no SQL Editor de um projeto Supabase com Storage habilitado.

## Limitações explícitas desta sprint

- O OCR não está conectado. O usuário anexa a nota e lança/concilia os itens manualmente; o anexo fica armazenado para consulta.
- O campo EAN/GTIN aceita digitação ou leitor externo que envia teclado. Scanner pela câmera do navegador/integração nativa Capacitor ainda não está implementado.
- Não há consulta externa automática de preços de supermercados. O histórico deriva das compras próprias ou de observações manuais.
- O funcionamento offline multi-dispositivo com fila de sincronização ainda não está implementado.
- O modo demonstração é apenas local e não substitui testes autenticados de duas contas no Supabase.

## Checklist de validação

- [ ] Executar migrations 001–004 em ordem.
- [ ] Criar residência e dois usuários membros.
- [ ] Cadastrar produto com estoque inicial acima do mínimo: não gerar reposição.
- [ ] Consumir até o mínimo: gerar item de reposição sem duplicidade.
- [ ] Repor produto: remover item automático não marcado como separado.
- [ ] Adicionar item manual e avulso à lista.
- [ ] Definir orçamento e conferir o modo mercado.
- [ ] Confirmar compra com dois produtos e validades diferentes.
- [ ] Confirmar que compra, itens, lotes, movimentos e preços aparecem uma única vez.
- [ ] Repetir chamada com o mesmo `client_request_id`: retornar a mesma compra.
- [ ] Anexar arquivo permitido e conferir acesso somente por membro da residência.
- [ ] Conferir histórico de preços e relatórios.
- [ ] Tentar acessar dados de outra residência e confirmar bloqueio por RLS.
