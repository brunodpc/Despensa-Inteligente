# Decisões de projeto — Despensa Inteligente

## Confirmadas

- Plataforma: PWA responsiva, mobile-first, instalável no celular e utilizável no desktop.
- Público: residência compartilhada; todos os membros operam o mesmo estoque.
- Idioma/moeda: pt-BR e BRL.
- Frontend: React, TypeScript e Vite.
- Backend: Supabase Auth + PostgreSQL + Storage (quando o módulo de notas for desenvolvido).
- Segurança: RLS em todas as tabelas expostas e privilégios explícitos; operações limitadas por residência, com administração protegida por papel.
- Estoque: lotes com unidade-base `g`, `ml` ou `un`; o histórico de movimentações é obrigatório. As quantidades de compra são convertidas para a unidade-base.
- Consumo: baixa FEFO, com bloqueio transacional por produto para evitar consumo concorrente acima do saldo.
- Integridade: o cliente não recebe permissão de escrita direta nas tabelas de lotes e movimentos; as RPCs `add_stock_lot` e `remove_stock` alteram ambas atomicamente.
- Primeira versão: uma conta participa de uma residência; a criação de uma segunda residência será bloqueada até existir seletor de residência ativa.
- Notas: entram como rascunho e exigem conferência humana antes de atualizar estoque.
- Modo demonstração: exibe dados ilustrativos no frontend sem fingir persistência ou compartilhamento.

## Permissões compartilhadas confirmadas

A opção escolhida foi `shared`: todos os membros (`owner`, `admin` e `member`) possuem as mesmas permissões operacionais dentro da própria residência. Todos podem cadastrar e editar produtos, arquivar produtos, registrar entradas/consumo/perdas/ajustes, organizar listas, registrar compras, preços e notas. Somente `owner` e `admin` podem criar/revogar convites e executar ações administrativas sobre membros e residência. O isolamento entre residências é sempre aplicado por `household_id` e RLS.

## Compartilhamento confirmado

O usuário escolheu oferecer os dois métodos:

- **Convite por e-mail:** ligado ao endereço informado; apenas a conta autenticada com aquele e-mail pode aceitar.
- **Link/código:** pode ser compartilhado por mensagem ou presencialmente; qualquer conta autenticada pode aceitar.
- Os dois métodos usam token aleatório de 128 bits; o banco armazena somente o hash SHA-256.
- Validade padrão de 7 dias, uso único e revogação disponível para proprietário/administrador.
- Novos participantes recebem papel `member`; promoção de administrador e remoção de membros ficam para uma etapa posterior.
- O envio de e-mail usa uma Supabase Edge Function com Resend. Sem as credenciais do serviço, o link/código continua disponível para compartilhamento manual.
- Uma conta só pode participar de uma residência nesta versão, reforçado por índice único no banco.

## A decidir em fase posterior

- Se haverá uma ou várias residências por usuário e seletor de residência ativa.
- Política padrão de orçamento mensal.
- Quais mercados/fontes externas de preço devem ser priorizados.
- Quais campos da nota fiscal serão obrigatórios para confirmação.
