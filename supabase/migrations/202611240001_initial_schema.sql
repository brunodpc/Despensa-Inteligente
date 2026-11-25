-- Despensa Inteligente | Fundação do banco
-- PostgreSQL / Supabase. Execute em um projeto novo ou via Supabase CLI.

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 60),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on public.household_members(user_id);

-- SECURITY DEFINER evita recursão de RLS ao consultar a tabela de membros.
create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_household_admin(target_household_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
      and hm.role in ('owner', 'admin')
  );
$$;

-- Cria residência e associa o usuário autenticado como proprietário em uma transação.
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'É necessário estar autenticado para criar uma residência.';
  end if;
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 60 then
    raise exception 'O nome da residência deve ter entre 2 e 60 caracteres.';
  end if;
  if exists (select 1 from public.household_members hm where hm.user_id = current_user_id) then
    raise exception 'Esta conta já participa de uma residência.';
  end if;

  insert into public.households (name, owner_id)
  values (trim(p_name), current_user_id)
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, current_user_id, 'owner');

  return new_household_id;
end;
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon_key text not null default 'package',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.categories (name, icon_key, sort_order) values
  ('Grãos e cereais', 'wheat', 10),
  ('Mercearia', 'shopping-basket', 20),
  ('Hortifruti', 'carrot', 30),
  ('Carnes e ovos', 'beef', 40),
  ('Laticínios', 'milk', 50),
  ('Bebidas', 'cup-soda', 60),
  ('Congelados', 'snowflake', 70),
  ('Padaria', 'croissant', 80),
  ('Temperos', 'sprout', 90),
  ('Limpeza', 'sparkles', 100),
  ('Higiene', 'soap-dispenser', 110),
  ('Outros', 'package', 120)
on conflict (name) do nothing;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  normalized_name text generated always as (lower(trim(name))) stored,
  brand text,
  barcode text,
  base_unit text not null check (base_unit in ('g', 'ml', 'un')),
  purchase_unit_label text not null default 'unidade',
  base_quantity_per_purchase_unit numeric(14,3) not null default 1 check (base_quantity_per_purchase_unit > 0),
  minimum_stock numeric(14,3) not null default 0 check (minimum_stock >= 0),
  target_stock numeric(14,3) not null default 0 check (target_stock >= 0),
  storage_location text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, normalized_name),
  check (target_stock >= minimum_stock)
);
create index if not exists products_household_idx on public.products(household_id);
create index if not exists products_barcode_idx on public.products(household_id, barcode) where barcode is not null;

create table if not exists public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null,
  initial_quantity numeric(14,3) not null check (initial_quantity > 0),
  remaining_quantity numeric(14,3) not null check (remaining_quantity >= 0 and remaining_quantity <= initial_quantity),
  unit text not null check (unit in ('g', 'ml', 'un')),
  unit_cost numeric(12,4) check (unit_cost is null or unit_cost >= 0),
  expires_on date,
  storage_location text,
  source text not null default 'manual' check (source in ('manual', 'purchase', 'adjustment', 'migration')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, product_id) references public.products(household_id, id) on delete restrict
);
create index if not exists stock_lots_product_idx on public.stock_lots(household_id, product_id);
create index if not exists stock_lots_expiry_idx on public.stock_lots(household_id, expires_on) where remaining_quantity > 0 and expires_on is not null;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null,
  stock_lot_id uuid,
  movement_type text not null check (movement_type in ('entry', 'consumption', 'loss', 'adjustment')),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  unit text not null check (unit in ('g', 'ml', 'un')),
  note text,
  source_reference text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (household_id, product_id) references public.products(household_id, id) on delete restrict,
  foreign key (household_id, stock_lot_id) references public.stock_lots(household_id, id) on delete restrict,
  check ((movement_type = 'entry' and quantity_delta > 0) or (movement_type in ('consumption', 'loss') and quantity_delta < 0) or movement_type = 'adjustment')
);
create index if not exists stock_movements_product_idx on public.stock_movements(household_id, product_id, created_at desc);

-- Operações de estoque são transacionais: não há escrita direta nas tabelas de lote/movimentação.
-- A linha do produto é bloqueada para serializar entradas e saídas concorrentes.
create or replace function public.add_stock_lot(
  p_household_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_unit text,
  p_unit_cost numeric default null,
  p_expires_on date default null,
  p_storage_location text default null,
  p_source text default 'manual',
  p_movement_type text default 'entry'
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_base_unit text;
  v_lot_id uuid;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or not public.is_household_member(p_household_id) then
    raise exception 'Acesso não autorizado a esta residência.' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'O custo unitário não pode ser negativo.';
  end if;
  if p_source not in ('manual', 'purchase', 'adjustment', 'migration') then
    raise exception 'Origem de estoque inválida.';
  end if;
  if p_movement_type not in ('entry', 'adjustment') then
    raise exception 'Tipo de movimentação de entrada inválido.';
  end if;

  select p.base_unit into v_base_unit
  from public.products p
  where p.id = p_product_id and p.household_id = p_household_id and p.is_active = true
  for update;
  if not found then
    raise exception 'Produto não encontrado ou inativo nesta residência.';
  end if;
  if p_unit is distinct from v_base_unit then
    raise exception 'Unidade informada (%) não corresponde à unidade-base do produto (%).', p_unit, v_base_unit;
  end if;

  insert into public.stock_lots (
    household_id, product_id, initial_quantity, remaining_quantity, unit,
    unit_cost, expires_on, storage_location, source, created_by
  ) values (
    p_household_id, p_product_id, p_quantity, p_quantity, v_base_unit,
    p_unit_cost, p_expires_on, p_storage_location, p_source, v_user_id
  ) returning id into v_lot_id;

  insert into public.stock_movements (
    household_id, product_id, stock_lot_id, movement_type, quantity_delta, unit, note, created_by
  ) values (
    p_household_id, p_product_id, v_lot_id, p_movement_type, p_quantity, v_base_unit,
    case when p_movement_type = 'entry' then 'Entrada de estoque' else 'Ajuste positivo de estoque' end,
    v_user_id
  );
  return v_lot_id;
end;
$$;

create or replace function public.remove_stock(
  p_household_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_movement_type text default 'consumption',
  p_note text default null
)
returns numeric
language plpgsql security definer
set search_path = ''
as $$
declare
  v_base_unit text;
  v_available numeric(14,3);
  v_remaining numeric(14,3);
  v_take numeric(14,3);
  v_lot record;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or not public.is_household_member(p_household_id) then
    raise exception 'Acesso não autorizado a esta residência.' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;
  if p_movement_type not in ('consumption', 'loss', 'adjustment') then
    raise exception 'Tipo de saída inválido.';
  end if;

  -- Bloqueia o produto para evitar que duas pessoas consumam o mesmo saldo ao mesmo tempo.
  select p.base_unit into v_base_unit
  from public.products p
  where p.id = p_product_id and p.household_id = p_household_id and p.is_active = true
  for update;
  if not found then
    raise exception 'Produto não encontrado ou inativo nesta residência.';
  end if;

  select coalesce(sum(l.remaining_quantity), 0) into v_available
  from public.stock_lots l
  where l.household_id = p_household_id
    and l.product_id = p_product_id
    and l.remaining_quantity > 0;

  if v_available < p_quantity then
    raise exception 'Estoque insuficiente. Disponível: % %, solicitado: % %.',
      v_available, v_base_unit, p_quantity, v_base_unit;
  end if;

  v_remaining := p_quantity;
  -- FEFO: lotes com vencimento mais próximo são consumidos primeiro; sem validade ficam por último.
  for v_lot in
    select l.id, l.remaining_quantity
    from public.stock_lots l
    where l.household_id = p_household_id
      and l.product_id = p_product_id
      and l.remaining_quantity > 0
    order by l.expires_on asc nulls last, l.created_at asc, l.id asc
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_lot.remaining_quantity, v_remaining);

    update public.stock_lots
    set remaining_quantity = remaining_quantity - v_take
    where id = v_lot.id and household_id = p_household_id and product_id = p_product_id;

    insert into public.stock_movements (
      household_id, product_id, stock_lot_id, movement_type, quantity_delta, unit, note, created_by
    ) values (
      p_household_id, p_product_id, v_lot.id, p_movement_type, -v_take, v_base_unit,
      coalesce(nullif(trim(p_note), ''), case when p_movement_type = 'loss' then 'Perda registrada' when p_movement_type = 'adjustment' then 'Ajuste negativo de estoque' else 'Consumo registrado' end),
      v_user_id
    );

    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'Não foi possível concluir a baixa integral do estoque.';
  end if;
  return p_quantity;
end;
$$;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  city text,
  notes text,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, name)
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null default 'Compras da casa',
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  budget numeric(12,2) check (budget is null or budget >= 0),
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);
create index if not exists shopping_lists_active_idx on public.shopping_lists(household_id, status, created_at desc);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  list_id uuid not null,
  product_id uuid,
  custom_name text,
  requested_quantity numeric(14,3) not null default 1 check (requested_quantity > 0),
  unit text not null check (unit in ('g', 'ml', 'un')),
  estimated_unit_price numeric(12,4) check (estimated_unit_price is null or estimated_unit_price >= 0),
  is_checked boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'low_stock', 'expiry', 'suggestion')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (household_id, list_id) references public.shopping_lists(household_id, id) on delete cascade,
  foreign key (household_id, product_id) references public.products(household_id, id) on delete restrict,
  check (product_id is not null or nullif(trim(custom_name), '') is not null)
);
create index if not exists shopping_items_list_idx on public.shopping_list_items(household_id, list_id, is_checked);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  store_id uuid,
  purchased_at timestamptz not null default now(),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'cancelled')),
  receipt_number text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, store_id) references public.stores(household_id, id) on delete restrict
);
create index if not exists purchases_household_date_idx on public.purchases(household_id, purchased_at desc);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  purchase_id uuid not null,
  product_id uuid,
  product_name_snapshot text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null check (unit in ('g', 'ml', 'un')),
  unit_price numeric(12,4) not null check (unit_price >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  created_at timestamptz not null default now(),
  foreign key (household_id, purchase_id) references public.purchases(household_id, id) on delete cascade,
  foreign key (household_id, product_id) references public.products(household_id, id) on delete restrict,
  unique (household_id, id)
);
create index if not exists purchase_items_product_idx on public.purchase_items(household_id, product_id, created_at desc);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null,
  store_id uuid,
  purchase_item_id uuid,
  unit_price numeric(12,4) not null check (unit_price >= 0),
  unit text not null check (unit in ('g', 'ml', 'un')),
  observed_at timestamptz not null default now(),
  source text not null default 'purchase' check (source in ('purchase', 'manual', 'external')),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (household_id, product_id) references public.products(household_id, id) on delete cascade,
  foreign key (household_id, store_id) references public.stores(household_id, id) on delete restrict,
  foreign key (household_id, purchase_item_id) references public.purchase_items(household_id, id) on delete restrict
);
create index if not exists price_history_lookup_idx on public.price_history(household_id, product_id, observed_at desc);

create table if not exists public.receipt_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  storage_path text,
  original_file_name text,
  mime_type text,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'review', 'confirmed', 'failed')),
  parsed_payload jsonb,
  error_message text,
  purchase_id uuid,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, purchase_id) references public.purchases(household_id, id) on delete restrict
);
create index if not exists receipt_imports_household_idx on public.receipt_imports(household_id, created_at desc);

-- Atualização automática de updated_at.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger households_set_updated_at before update on public.households for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger shopping_lists_set_updated_at before update on public.shopping_lists for each row execute function public.set_updated_at();
create trigger receipt_imports_set_updated_at before update on public.receipt_imports for each row execute function public.set_updated_at();

-- RLS: todas as tabelas com dados da residência ficam isoladas por membership.
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.stock_lots enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stores enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.price_history enable row level security;
alter table public.receipt_imports enable row level security;

-- Não confiar apenas nas policies: grants também são restringidos explicitamente.
revoke all on public.households, public.household_members, public.categories, public.products,
  public.stock_lots, public.stock_movements, public.stores, public.shopping_lists,
  public.shopping_list_items, public.purchases, public.purchase_items, public.price_history,
  public.receipt_imports from anon, authenticated;

grant select on public.households, public.household_members, public.categories, public.products,
  public.stock_lots, public.stock_movements, public.stores, public.shopping_lists,
  public.shopping_list_items, public.purchases, public.purchase_items, public.price_history,
  public.receipt_imports to authenticated;
grant update (name) on public.households to authenticated;
grant insert, update, delete on public.products,
  public.stores, public.shopping_lists,
  public.shopping_list_items, public.purchases, public.purchase_items, public.price_history,
  public.receipt_imports to authenticated;

-- Residências e membros.
create policy households_read_member on public.households for select to authenticated
  using (public.is_household_member(id));
create policy households_update_admin on public.households for update to authenticated
  using (public.is_household_admin(id)) with check (public.is_household_admin(id));
-- Exclusão de residência não fica disponível no cliente; será feita por fluxo controlado de encerramento.
create policy household_members_read_member on public.household_members for select to authenticated
  using (public.is_household_member(household_id));
-- Escrita em household_members será feita exclusivamente por RPC de convite validado.
create policy categories_read_authenticated on public.categories for select to authenticated using (true);

-- Dados operacionais: cada membro pode consultar e operar a despensa compartilhada.
create policy products_member_all on public.products for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy stock_lots_member_read on public.stock_lots for select to authenticated
  using (public.is_household_member(household_id));
create policy stock_movements_member_read on public.stock_movements for select to authenticated
  using (public.is_household_member(household_id));
create policy stores_member_all on public.stores for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy shopping_lists_member_all on public.shopping_lists for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy shopping_items_member_all on public.shopping_list_items for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy purchases_member_all on public.purchases for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy purchase_items_member_all on public.purchase_items for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy price_history_member_all on public.price_history for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy receipt_imports_member_all on public.receipt_imports for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- Segurança das funções: só usuários autenticados podem chamar as funções de autorização/criação.
revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.is_household_admin(uuid) from public, anon;
revoke all on function public.create_household(text) from public, anon;
revoke all on function public.add_stock_lot(uuid, uuid, numeric, text, numeric, date, text, text, text) from public, anon;
revoke all on function public.remove_stock(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_admin(uuid) to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.add_stock_lot(uuid, uuid, numeric, text, numeric, date, text, text, text) to authenticated;
grant execute on function public.remove_stock(uuid, uuid, numeric, text, text) to authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Observação: a chave service_role nunca deve ser usada no frontend.
