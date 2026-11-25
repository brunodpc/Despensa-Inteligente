# Despensa Inteligente

Aplicativo PWA para gerenciamento compartilhado da cozinha: estoque por lotes, reposição automática, listas, registro de compras, preços e relatórios.

## Estado desta entrega — Sprint 06

O projeto contém:
- React + TypeScript + Vite, identidade visual responsiva e navegação mobile-first;
- PWA com manifest e service worker para o app shell;
- autenticação por e-mail/senha via Supabase Auth e residência compartilhada;
- convites por e-mail e por link/código, com validade, uso único e revogação;
- permissões compartilhadas para membros operarem produtos, estoque, listas e compras; convites e administração permanecem restritos a owner/admin;
- catálogo de produtos, categorias, unidades-base, lotes e validade;
- operações transacionais de entrada/consumo com histórico e baixa FEFO;
- Dashboard ligado aos dados reais no modo Supabase e aos dados persistidos da prévia local;
- Configurações de perfil, segurança e preferências;
- lista de compras com reposição automática quando o estoque atinge o mínimo;
- modo mercado com quantidades, preços por embalagem, carrinho e orçamento;
- registro de compras com estabelecimento, produtos, quantidades, preço, desconto, validade e anexo opcional de nota;
- confirmação transacional que atualiza compras, itens, lotes, movimentações e preços;
- histórico de preços próprios, com registros de compras e preços manuais;
- relatórios de gastos mensais, categorias, produtos, ticket médio e perdas separadas por unidade;
- scaffolding para Tauri 2 (Windows) e Capacitor 8 (Android/iOS).

**Importante:** a Sprint 06 implementa o fluxo manual de registro/conferência da nota. OCR não está conectado; o código de barras aceita digitação ou leitor USB/Bluetooth como teclado, mas a leitura pela câmera ainda não está integrada. Não há busca externa automática de preços nesta versão.

## Requisitos

- Node.js 22.12+ (recomendado Node 24 ou 26 LTS)
- npm 10+
- Projeto Supabase para autenticação, persistência e compartilhamento reais

## Executar no Windows (PowerShell)

Na pasta que contém `package.json`:

```powershell
npm.cmd install
Copy-Item env.example .env.local
npm.cmd run dev
```

Abra `http://localhost:5173`. Se o terminal bloquear `npm.ps1`, use `npm.cmd` nos comandos PowerShell.

Sem credenciais, o app abre em **prévia local**. Essa prévia persiste no `localStorage` deste navegador/computador; ela não sincroniza com outros dispositivos e usa dados demonstrativos.

## Configurar Supabase

1. Crie ou abra o projeto no Supabase.
2. Copie a Project URL e a Publishable key (`sb_publishable_...`).
3. Preencha `.env.local`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave
```

4. No SQL Editor, execute uma vez e nesta ordem:
   - `supabase/migrations/202611240001_initial_schema.sql`
   - `supabase/migrations/202611240002_household_invitations.sql`
   - `supabase/migrations/202611240003_shared_inventory_permissions.sql`
   - `supabase/migrations/202611240004_shopping_purchases_prices.sql`
5. Habilite Authentication → Providers → Email.
6. Reinicie o Vite após alterar `.env.local`.
7. Para envio de convites por e-mail, configure o Resend e publique a Edge Function descrita em `supabase/README.md`. Convites por link/código não dependem do envio de e-mail.

A migration 004 também cria o bucket privado `purchase-receipts` no Supabase Storage. O bucket e as policies são necessários para anexos de nota.

**Nunca coloque Secret key ou `service_role` em variáveis `VITE_`, no frontend ou no Git.** O frontend usa apenas a Publishable key e depende das políticas RLS para isolar as residências.

## Comandos úteis

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
npm.cmd run preview
```

## Fluxo dos módulos

1. Estoque mínimo ou desejado aciona a sugestão de reposição na lista ativa.
2. A lista e o orçamento são compartilhados entre os membros da residência.
3. No modo mercado, a pessoa marca itens no carrinho, ajusta quantidade e preço e acompanha o orçamento.
4. Em Registrar compra, informa os itens efetivamente comprados e pode anexar a nota.
5. Ao confirmar, o banco registra a compra, cria lotes e movimentos e atualiza o histórico de preços na mesma transação.
6. Histórico e relatórios consultam as compras confirmadas e os preços registrados.

## Convenções de dados

- Unidades-base: gramas (`g`), mililitros (`ml`) e unidades (`un`).
- Quantidades de lista, preços estimados, custos dos lotes e preços históricos são normalizados por unidade-base. A migration 004 aumenta a precisão para oito casas decimais para evitar distorções ao converter preço por grama/ml de volta para preço por embalagem.
- O estoque vem da soma dos lotes. Entradas e saídas são feitas por RPCs e não por edição direta de saldo.
- Saídas consomem primeiro lotes com vencimento mais próximo (FEFO).
- Relatórios exibem perdas separadas por unidade. Gastos por categoria/produto usam os valores das linhas antes de eventual desconto global; gastos mensais usam o total líquido confirmado.

## Testes da Sprint 06

Siga `supabase/tests/sprint-06-commerce-checklist.md`. A validação de produção exige duas contas autenticadas, aplicação das quatro migrations e testes de isolamento RLS no Supabase real.

## Multiplataforma

- **Windows:** Tauri 2; pré-requisitos e build em `docs/PLANO_PUBLICACAO.md`.
- **Android:** Capacitor 8; gerar a plataforma com `npx cap add android`, sincronizar e abrir no Android Studio.
- **iOS:** exige macOS e Xcode para compilar/assinar.
- **PWA:** pode ser hospedada em HTTPS e instalada por navegadores compatíveis.

A estrutura de empacotamento está preparada, mas nenhum instalador `.exe`, APK/AAB ou IPA foi compilado e testado nesta entrega. Os identificadores nativos ainda devem ser confirmados antes de enviar às lojas.

## Limitações conhecidas

- OCR da nota ainda não implementado: o anexo é guardado para conferência e os itens são digitados manualmente.
- Scanner pela câmera ainda não implementado. O campo EAN aceita digitação ou leitor externo configurado como teclado, se o código já estiver cadastrado.
- Sem integração automática de preço externo; o histórico usa compras próprias e observações manuais.
- A prévia local não é multiusuário; dados ficam no `localStorage` do navegador.
- A fila de operações offline com resolução de conflitos entre dispositivos ainda não foi implementada.
- Não foi possível concluir a instalação de dependências e executar um build completo neste ambiente de geração. Faça `npm.cmd install`, `npm.cmd run typecheck` e `npm.cmd run build` no Windows antes de usar a nova versão. As migrations ainda precisam ser executadas e verificadas no projeto Supabase.


## Correção técnica da Sprint 06

Consulte `docs/SPRINT_06_CORRECOES_TYPESCRIPT.md` para as correções de null-safety do modo mercado, campo de marca na lista de compras e aprovação restrita do script `esbuild@0.28.2`.

## Prévia local: cadastro de produtos

Quando o Supabase não está configurado, o aplicativo abre em **Prévia local**. Nessa experiência, o cadastro de produtos na Despensa é permitido e fica salvo no `localStorage` do navegador utilizado. Os dados são locais e não são compartilhados com outros dispositivos ou moradores.

Para cadastrar na prévia:
1. Abra **Minha despensa**.
2. Clique em **Adicionar produto**.
3. Preencha nome, unidade, embalagem, conversão e níveis de estoque.
4. Clique em **Cadastrar produto**.

A criação local atualiza a lista da despensa e a lista de reposição sugerida. Para sincronização real entre moradores, autenticação e estoque compartilhado, configure o Supabase conforme `GUIA_INSTALACAO_WINDOWS.md`.
