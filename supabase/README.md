# Supabase — Despensa Inteligente

## Aplicação das migrations

Aplique as **três migrations**, uma por vez e exatamente nesta ordem, em um projeto Supabase de desenvolvimento:

1. `migrations/202611240001_initial_schema.sql`
2. `migrations/202611240002_household_invitations.sql`
3. `migrations/202611240003_shared_inventory_permissions.sql`

Você pode usar o SQL Editor do Dashboard ou Supabase CLI com migrations vinculadas ao projeto. Faça backup antes de aplicar em qualquer banco com dados existentes.

## Convites por e-mail e link/código

A segunda migration cria:

- `household_invitations`: armazena hash SHA-256 do código, e-mail opcional, validade, autor, aceite e revogação. O código puro nunca é persistido.
- `create_household_invitation`: somente proprietário/administrador pode criar um convite para membro.
- `accept_household_invitation`: exige usuário autenticado, valida validade e e-mail de destino, e associa a conta à residência.
- `list_household_invitations`: lista apenas metadados seguros e não retorna o hash.
- `revoke_household_invitation`: permite ao administrador revogar convite pendente.
- `get_household_invitation_email`: RPC limitada ao autor do convite, usada pela Edge Function para obter destinatário e nome da residência.

A tabela de convites não concede acesso direto ao cliente; as operações são feitas por RPCs `SECURITY DEFINER` com verificações explícitas de autorização. O índice único em `household_members.user_id` aplica a regra de uma residência por conta inclusive em chamadas concorrentes.

## Deploy do envio de e-mail

A função `functions/send-household-invitation` usa um JWT de usuário e mantém a verificação JWT padrão habilitada. O provedor Resend envia a mensagem; nenhuma chave Resend ou chave Supabase secreta é exposta ao frontend.

1. Crie/verifique um domínio de envio no Resend.
2. Configure os secrets do projeto:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
supabase secrets set INVITATION_EMAIL_FROM="Despensa Inteligente <convites@seudominio.com>"
supabase secrets set APP_BASE_URL="https://seu-app.example.com"
```

3. Em Authentication → URL Configuration, adicione as URLs de redirecionamento permitidas para o aplicativo, incluindo `http://localhost:5173/convite` no desenvolvimento e o endereço HTTPS de produção com o caminho `/convite`.
4. Faça deploy:

```bash
supabase functions deploy send-household-invitation
```

`SUPABASE_URL` e `SUPABASE_ANON_KEY` são variáveis fornecidas pelo ambiente Supabase para a função. O modelo atual deixa `verify_jwt = true` explicitamente habilitado em `config.toml`. Para desenvolvimento local, configure os secrets em `supabase/functions/.env` e sirva a função pelo Supabase CLI.

Se a Edge Function ou os secrets de e-mail ainda não estiverem configurados, o aplicativo continua permitindo gerar link/código compartilhável. O envio por e-mail mostrará um aviso, sem invalidar o convite criado.

## Testes

Siga `tests/household-invitations-checklist.md` usando duas contas e um projeto de desenvolvimento. Não valide convites ou RLS com contas reais de produção.
