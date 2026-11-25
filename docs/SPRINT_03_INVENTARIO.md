# Sprint 03 — Acesso compartilhado, catálogo e estoque

## Decisão de produto confirmada

A residência utiliza **permissões operacionais compartilhadas**. `owner`, `admin` e `member` podem realizar as operações do dia a dia. O papel é aplicado na fronteira da residência e não por produto.

| Operação | Owner | Admin | Member |
|---|---:|---:|---:|
| Consultar produtos e estoque | Sim | Sim | Sim |
| Cadastrar e editar produtos | Sim | Sim | Sim |
| Arquivar produto | Sim | Sim | Sim |
| Registrar entrada, consumo, perda e ajuste | Sim | Sim | Sim |
| Gerenciar listas e itens | Sim | Sim | Sim |
| Registrar compras e preços | Sim | Sim | Sim |
| Importar/revisar notas | Sim | Sim | Sim |
| Criar/revogar convites | Sim | Sim | Não |
| Gerenciar membros e configurações administrativas | Sim | Sim | Não |

Toda consulta ou escrita operacional é limitada por `household_id` e pelas políticas RLS. A conta só pode pertencer a uma residência nesta versão.

## Entregas implementadas no código

- Migration `202611240003_shared_inventory_permissions.sql`.
- Política de produto: leitura e atualização para membros; criação passa pela RPC; arquivamento lógico em `is_active`; exclusão física bloqueada para `authenticated`.
- RPC `create_product_with_stock`: cria o cadastro e o lote inicial opcional em uma única transação.
- Tela `PantryPage`: consulta produtos, categorias e lotes; agrega saldo; pesquisa e filtros; cadastro, edição, arquivamento, entrada e consumo.
- Entrada de estoque usa `add_stock_lot`; consumo usa `remove_stock`, que aplica FEFO e bloqueio da linha do produto para evitar baixa concorrente do mesmo saldo.
- Unidades internas `g`, `ml`, `un`. A tela permite informar quantidade em embalagens e converter para a unidade-base.

## Regras importantes

1. O saldo atual é a soma de `stock_lots.remaining_quantity` dos lotes ativos.
2. Entradas e saídas devem passar pelas RPCs; o cliente não escreve diretamente em lotes ou movimentações.
3. Consumo segue FEFO: vence primeiro, sai primeiro; lotes sem validade ficam por último.
4. Produto não é apagado fisicamente: é arquivado com `is_active = false`, preservando histórico.
5. Estoque mínimo e desejado são armazenados na unidade-base. A interface os apresenta como múltiplos da unidade de compra cadastrada.
6. `stock_lots.unit_cost` registra custo por unidade-base; quando o usuário informa custo por embalagem, a interface divide pela conversão.

## Validação manual obrigatória após aplicar as migrations

Use duas contas autenticadas (A e B) na mesma residência e uma terceira (C) em outra residência.

- [ ] A cria produto com estoque inicial; B visualiza o mesmo produto e saldo.
- [ ] B registra consumo; A vê o saldo reduzido e a movimentação correspondente.
- [ ] A registra uma nova entrada com validade; B vê o novo lote e a próxima validade.
- [ ] B edita dados do produto; A vê as alterações.
- [ ] B arquiva produto; o produto desaparece da lista ativa, mas lotes e movimentos permanecem no banco.
- [ ] A e B conseguem operar listas/compras da própria residência.
- [ ] C não consegue consultar nem modificar produtos, lotes, movimentos, listas ou compras de A/B.
- [ ] B (papel `member`) não consegue criar ou revogar convites.
- [ ] A/owner consegue gerenciar convites.
- [ ] Duas tentativas concorrentes de consumo que excedam o saldo total não deixam saldo negativo; apenas operações cobertas pelo saldo são confirmadas.

## Limitações desta entrega

- A migration ainda precisa ser aplicada e validada em um projeto Supabase real.
- O ambiente atual não conseguiu concluir `npm install`; portanto, build final e execução visual não foram validados nesta sessão.
- A tela de despensa opera com Supabase configurado. Sem credenciais, exibe dados ilustrativos e desabilita alterações.
- Dashboard, lista de compras, scanner, OCR, modo mercado, comparação externa e relatórios seguem como próximas entregas.
