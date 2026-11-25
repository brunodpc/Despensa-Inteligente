# Checklist de testes — Sprint 06

## A. Lista de compras
1. Entrar com membro da residência A.
2. Abrir `/compras` e conferir a lista ativa.
3. Adicionar produto do catálogo, ajustar quantidade e marcar como separado.
4. Adicionar item avulso e removê-lo.
5. Definir orçamento e conferir persistência após recarregar.
6. Abrir `/modo-mercado` e verificar que lista e orçamento são os mesmos.

## B. Reposição automática
1. Criar produto com estoque mínimo 1.000 g, desejado 3.000 g e estoque inicial 2.000 g.
2. Confirmar que a lista não contém o produto.
3. Consumir 1.000 g via `remove_stock`.
4. Confirmar que a lista recebe uma linha com quantidade 2.000 g.
5. Consumir/repor novamente e confirmar que não há duplicidade.

## C. Compra confirmada
1. Abrir `/registrar-compra`.
2. Informar estabelecimento, data, produto, quantidade de embalagens e preço.
3. Adicionar validade e anexo JPG/PNG/WEBP/PDF opcional.
4. Confirmar.
5. Verificar `purchases`, `purchase_items`, `stock_lots`, `stock_movements`, `price_history` e `receipt_imports`.
6. Conferir que o estoque aumentou pela conversão embalagem → unidade-base.
7. Repetir a RPC manualmente com o mesmo `p_client_request_id` e confirmar idempotência.

## D. Histórico e relatórios
1. Abrir `/precos`; conferir preços da compra confirmada.
2. Registrar preço observado manualmente e conferir unidade convertida.
3. Abrir `/relatorios`; conferir total mensal, total de seis meses, ticket médio, categorias e produtos.

## E. Segurança
1. Testar com dois membros da mesma residência: ambos leem/escrevem seus próprios dados.
2. Testar com usuário sem vínculo e com membro de outra residência: as consultas e operações devem falhar/bloquear.
3. Tentar acessar objeto do bucket `purchase-receipts` de outra residência: acesso negado.
4. Conferir que nenhum secret/service_role está no bundle frontend.

## F. Precisão e regras de catálogo
1. Registrar um pacote de 1 kg por R$ 5,25 e conferir que o histórico apresente R$ 5,25 por embalagem (e não valor arredondado por grama).
2. Registrar preço estimado de R$ 5,25 por 1 kg na lista e conferir o mesmo total no modo mercado.
3. Arquivar produto que estava na reposição automática e conferir que a sugestão automática pendente seja removida.
4. Executar duas confirmações simultâneas com o mesmo `p_client_request_id` e confirmar que existe apenas uma compra.
5. Conferir perdas em produtos medidos em `g`, `ml` e `un`: o relatório deve apresentar cada unidade separadamente.
