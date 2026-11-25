-- Despensa Inteligente | Convites por e-mail e por link/código
-- O código puro nunca é armazenado. Somente seu SHA-256 fica no banco.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- A regra de uma residência por conta também é aplicada no banco,
-- inclusive para duas aceitações concorrentes.
create unique index if not exists household_members_one_household_per_user_idx
  on public.household_members(user_id);

create table if not exists public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text,
  role text not null default 'member' check (role = 'member'),
  token_hash text not null unique check (token_hash ~ '^[A-F0-9]{64}$'),
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check ((accepted_at is null and accepted_by is null) or (accepted_at is not null and accepted_by is not null))
);

create index if not exists household_invitations_household_idx
  on public.household_invitations(household_id, created_at desc);
create index if not exists household_invitations_expiry_idx
  on public.household_invitations(expires_at)
  where accepted_at is null and revoked_at is null;

alter table public.household_invitations enable row level security;
-- Não conceder SELECT direto: a tabela contém hashes de credenciais de convite.
revoke all on public.household_invitations from anon, authenticated;

-- Cria convite de membro. O chamador gera um token de 128 bits no navegador;
-- a função normaliza e armazena apenas o hash.
create or replace function public.create_household_invitation(
  p_household_id uuid,
  p_code text,
  p_email text default null,
  p_expires_in_hours integer default 168
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_code text;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_id uuid;
  v_hash text;
begin
  if v_user_id is null then
    raise exception 'É necessário entrar na sua conta.' using errcode = '42501';
  end if;
  if not public.is_household_admin(p_household_id) then
    raise exception 'Somente o proprietário ou administrador pode convidar pessoas.' using errcode = '42501';
  end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Fa-f0-9]', '', 'g'));
  if length(v_code) <> 32 then
    raise exception 'Código de convite inválido. Gere um novo código.' using errcode = '22023';
  end if;
  if p_expires_in_hours is null or p_expires_in_hours < 1 or p_expires_in_hours > 720 then
    raise exception 'A validade do convite deve ser de 1 hora a 30 dias.' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'Informe um endereço de e-mail válido.' using errcode = '22023';
  end if;
  if v_email is not null and exists (
    select 1
    from public.household_members hm
    join auth.users u on u.id = hm.user_id
    where hm.household_id = p_household_id and lower(u.email) = v_email
  ) then
    raise exception 'Este e-mail já pertence a um membro desta residência.' using errcode = '23505';
  end if;

  v_hash := encode(extensions.digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex');
  insert into public.household_invitations (
    household_id, invited_email, token_hash, invited_by, expires_at
  ) values (
    p_household_id, v_email, upper(v_hash), v_user_id, now() + make_interval(hours => p_expires_in_hours)
  ) returning id into v_id;
  return v_id;
end;
$$;

-- Aceita convite usando o código. Um usuário só pode participar de uma residência.
create or replace function public.accept_household_invitation(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_code text;
  v_hash text;
  v_inv public.household_invitations%rowtype;
  v_existing_household uuid;
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta antes de aceitar o convite.' using errcode = '42501';
  end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Fa-f0-9]', '', 'g'));
  if length(v_code) <> 32 then
    raise exception 'Código de convite inválido ou incompleto.' using errcode = '22023';
  end if;
  v_hash := upper(encode(extensions.digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex'));

  select * into v_inv
  from public.household_invitations i
  where i.token_hash = v_hash
  for update;

  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at <= now() then
    raise exception 'Este convite não existe, expirou, foi revogado ou já foi utilizado.' using errcode = '22023';
  end if;
  if v_inv.invited_email is not null and v_inv.invited_email <> v_email then
    raise exception 'Este convite foi enviado para outro endereço de e-mail. Entre com a conta correspondente.' using errcode = '42501';
  end if;

  select hm.household_id into v_existing_household
  from public.household_members hm
  where hm.user_id = v_user_id
  limit 1;

  if v_existing_household = v_inv.household_id then
    raise exception 'Sua conta já faz parte desta residência. Peça um novo convite para outra pessoa.' using errcode = '23505';
  end if;
  if v_existing_household is not null and v_existing_household <> v_inv.household_id then
    raise exception 'Sua conta já participa de outra residência. Uma conta só pode estar vinculada a uma residência nesta versão.' using errcode = '23505';
  end if;

  if v_existing_household is null then
    insert into public.household_members (household_id, user_id, role)
    values (v_inv.household_id, v_user_id, 'member');
  end if;

  update public.household_invitations
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_inv.id;

  return v_inv.household_id;
end;
$$;

-- Lista dados seguros para a tela administrativa; nunca retorna token_hash.
create or replace function public.list_household_invitations(p_household_id uuid)
returns table (
  id uuid,
  invited_email text,
  role text,
  created_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  invitation_status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_admin(p_household_id) then
    raise exception 'Somente administradores podem consultar os convites.' using errcode = '42501';
  end if;
  return query
    select i.id, i.invited_email, i.role, i.created_at, i.expires_at,
      i.accepted_at, i.revoked_at,
      case
        when i.revoked_at is not null then 'revoked'
        when i.accepted_at is not null then 'accepted'
        when i.expires_at <= now() then 'expired'
        else 'pending'
      end
    from public.household_invitations i
    where i.household_id = p_household_id
    order by i.created_at desc;
end;
$$;

create or replace function public.revoke_household_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  select i.household_id into v_household_id
  from public.household_invitations i
  where i.id = p_invitation_id;
  if v_household_id is null or not public.is_household_admin(v_household_id) then
    raise exception 'Convite não encontrado ou operação não autorizada.' using errcode = '42501';
  end if;
  update public.household_invitations
  set revoked_at = now()
  where id = p_invitation_id and accepted_at is null and revoked_at is null;
end;
$$;

-- RPC exclusiva da Edge Function: confirma que o convite foi criado pelo chamador
-- e foi destinado a e-mail antes de permitir o envio da mensagem.
create or replace function public.get_household_invitation_email(p_code text)
returns table (recipient_email text, household_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_code text;
  v_hash text;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Fa-f0-9]', '', 'g'));
  if length(v_code) <> 32 then
    raise exception 'Código inválido.' using errcode = '22023';
  end if;
  v_hash := upper(encode(extensions.digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex'));

  return query
    select i.invited_email, h.name, i.expires_at
    from public.household_invitations i
    join public.households h on h.id = i.household_id
    where i.token_hash = v_hash
      and i.invited_by = v_user_id
      and i.invited_email is not null
      and i.accepted_at is null
      and i.revoked_at is null
      and i.expires_at > now()
      and public.is_household_admin(i.household_id);
end;
$$;

revoke all on function public.create_household_invitation(uuid, text, text, integer) from public, anon;
revoke all on function public.accept_household_invitation(text) from public, anon;
revoke all on function public.list_household_invitations(uuid) from public, anon;
revoke all on function public.revoke_household_invitation(uuid) from public, anon;
revoke all on function public.get_household_invitation_email(text) from public, anon;
grant execute on function public.create_household_invitation(uuid, text, text, integer) to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;
grant execute on function public.list_household_invitations(uuid) to authenticated;
grant execute on function public.revoke_household_invitation(uuid) to authenticated;
grant execute on function public.get_household_invitation_email(text) to authenticated;

comment on table public.household_invitations is 'Convites de uso único para ingresso em residência. O código original nunca é armazenado.';
