-- Despensa Inteligente | Lista inteligente, compras, preços e relatórios
-- Execute após as migrations 001, 002 e 003.

alter table public.purchases
  add column if not exists client_request_id uuid;

-- Preços normalizados por grama/ml precisam de precisão maior que quatro casas,
-- para que a conversão de volta ao preço da embalagem não altere centavos.
alter table public.stock_lots
  alter column unit_cost type numeric(14,8) using unit_cost::numeric(14,8);
alter table public.purchase_items
  alter column unit_price type numeric(14,8) using unit_price::numeric(14,8);
alter table public.price_history
  alter column unit_price type numeric(14,8) using unit_price::numeric(14,8);
alter table public.shopping_list_items
  alter column estimated_unit_price type numeric(14,8) using estimated_unit_price::numeric(14,8);

create unique index if not exists purchases_household_request_uidx
  on public.purchases(household_id, client_request_id)
  where client_request_id is not null;

-- Uma lista ativa por residência e no máximo uma linha de produto por lista.
with ranked_active as (
  select id, row_number() over (partition by household_id order by created_at desc, id desc) as position
  from public.shopping_lists
  where status = 'active'
)
update public.shopping_lists sl
set status = 'archived', updated_at = now()
from ranked_active ra
where sl.id = ra.id and ra.position > 1;

create unique index if not exists shopping_lists_one_active_per_household_uidx
  on public.shopping_lists(household_id)
  where status = 'active';

with ranked_items as (
  select id, row_number() over (partition by household_id, list_id, product_id order by created_at, id) as position
  from public.shopping_list_items
  where product_id is not null
)
delete from public.shopping_list_items sli
using ranked_items ri
where sli.id = ri.id and ri.position > 1;

create unique index if not exists shopping_list_items_product_uidx
  on public.shopping_list_items(household_id, list_id, product_id)
  where product_id is not null;

-- Sincroniza produtos abaixo do estoque mínimo com a lista ativa.
-- requested_quantity e estimated_unit_price são armazenados na unidade-base do produto.
create or replace function public.sync_low_stock_shopping_list(p_household_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list_id uuid;
  v_product record;
  v_current numeric(14,3);
  v_needed numeric(14,3);
begin
  if (select auth.uid()) is null or not public.is_household_member(p_household_id) then
    raise exception 'Acesso não autorizado a esta residência.' using errcode = '42501';
  end if;

  select id into v_list_id
  from public.shopping_lists
  where household_id = p_household_id and status = 'active'
  order by created_at desc
  limit 1
  for update;

  if v_list_id is null then
    insert into public.shopping_lists (household_id, name, status, created_by)
    values (p_household_id, 'Compras da casa', 'active', (select auth.uid()))
    on conflict (household_id) where status = 'active'
    do update set updated_at = now()
    returning id into v_list_id;
  end if;

  for v_product in
    select p.id, p.base_unit, p.base_quantity_per_purchase_unit, p.minimum_stock, p.target_stock
    from public.products p
    where p.household_id = p_household_id and p.is_active = true
  loop
    select coalesce(sum(l.remaining_quantity), 0)
      into v_current
    from public.stock_lots l
    where l.household_id = p_household_id
      and l.product_id = v_product.id;

    if v_product.minimum_stock > 0 and v_current <= v_product.minimum_stock then
      v_needed := greatest(v_product.target_stock - v_current, v_product.base_quantity_per_purchase_unit);

      insert into public.shopping_list_items (
        household_id, list_id, product_id, custom_name, requested_quantity, unit, source, added_by
      ) values (
        p_household_id, v_list_id, v_product.id, null, v_needed,
        v_product.base_unit, 'low_stock', (select auth.uid())
      )
      on conflict (household_id, list_id, product_id) where product_id is not null
      do update set requested_quantity = excluded.requested_quantity
      where public.shopping_list_items.source = 'low_stock'
        and public.shopping_list_items.is_checked = false;
    else
      delete from public.shopping_list_items
      where household_id = p_household_id
        and list_id = v_list_id
        and product_id = v_product.id
        and source = 'low_stock'
        and is_checked = false;
    end if;
  end loop;

  delete from public.shopping_list_items sli
  using public.products p
  where sli.household_id = p_household_id
    and sli.list_id = v_list_id
    and sli.product_id = p.id
    and p.household_id = p_household_id
    and p.is_active = false
    and sli.source = 'low_stock'
    and sli.is_checked = false;

  return v_list_id;
end;
$$;

create or replace function public.trigger_sync_low_stock_from_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_low_stock_shopping_list(new.household_id);
  return new;
end;
$$;

drop trigger if exists stock_movement_sync_low_stock on public.stock_movements;
create trigger stock_movement_sync_low_stock
after insert on public.stock_movements
for each row execute function public.trigger_sync_low_stock_from_movement();

create or replace function public.trigger_sync_low_stock_from_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.minimum_stock is distinct from old.minimum_stock
    or new.target_stock is distinct from old.target_stock
    or new.is_active is distinct from old.is_active then
    perform public.sync_low_stock_shopping_list(new.household_id);
  end if;
  return new;
end;
$$;

drop trigger if exists product_sync_low_stock on public.products;
create trigger product_sync_low_stock
after update of minimum_stock, target_stock, is_active on public.products
for each row execute function public.trigger_sync_low_stock_from_product();

-- Confirma a compra e registra itens, lotes, movimentações e histórico de preços
-- dentro de uma única transação. Repetições com o mesmo client_request_id são idempotentes.
create or replace function public.confirm_household_purchase(
  p_household_id uuid,
  p_client_request_id uuid,
  p_store_name text,
  p_purchased_at timestamptz,
  p_discount numeric,
  p_notes text,
  p_items jsonb,
  p_list_id uuid default null,
  p_receipt_storage_path text default null,
  p_receipt_original_file_name text default null,
  p_receipt_mime_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase_id uuid;
  v_store_id uuid;
  v_item jsonb;
  v_product record;
  v_quantity numeric(14,3);
  v_package_price numeric(12,4);
  v_base_quantity numeric(14,3);
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2);
  v_purchase_item_id uuid;
  v_expires_on date;
  v_item_count integer := 0;
begin
  if (select auth.uid()) is null or not public.is_household_member(p_household_id) then
    raise exception 'Acesso não autorizado a esta residência.' using errcode = '42501';
  end if;
  if p_client_request_id is null then
    raise exception 'Identificador da solicitação é obrigatório.';
  end if;

  select id into v_purchase_id
  from public.purchases
  where household_id = p_household_id and client_request_id = p_client_request_id;
  if v_purchase_id is not null then
    return v_purchase_id;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione pelo menos um produto à compra.';
  end if;
  if coalesce(p_discount, 0) < 0 then
    raise exception 'O desconto não pode ser negativo.';
  end if;
  if p_list_id is not null and not exists (
    select 1 from public.shopping_lists sl
    where sl.id = p_list_id and sl.household_id = p_household_id
  ) then
    raise exception 'Lista de compras não encontrada nesta residência.';
  end if;

  if nullif(trim(coalesce(p_store_name, '')), '') is not null then
    insert into public.stores (household_id, name)
    values (p_household_id, left(trim(p_store_name), 100))
    on conflict (household_id, name) do update set name = excluded.name
    returning id into v_store_id;
  end if;

  insert into public.purchases (
    household_id, store_id, purchased_at, subtotal, discount, total,
    status, notes, created_by, confirmed_at, client_request_id
  ) values (
    p_household_id, v_store_id, coalesce(p_purchased_at, now()), 0, coalesce(p_discount, 0), 0,
    'confirmed', nullif(trim(coalesce(p_notes, '')), ''), (select auth.uid()), now(), p_client_request_id
  )
  on conflict (household_id, client_request_id) where client_request_id is not null
  do nothing
  returning id into v_purchase_id;

  -- Duas tentativas simultâneas com o mesmo identificador não podem duplicar a compra.
  if v_purchase_id is null then
    select id into v_purchase_id
    from public.purchases
    where household_id = p_household_id and client_request_id = p_client_request_id;
    if v_purchase_id is null then
      raise exception 'Não foi possível confirmar a solicitação de compra.';
    end if;
    return v_purchase_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_count := v_item_count + 1;
    v_quantity := (v_item->>'quantity')::numeric;
    v_package_price := (v_item->>'unit_price')::numeric;
    v_expires_on := nullif(v_item->>'expires_on', '')::date;

    if v_quantity is null or v_quantity <= 0 or v_package_price is null or v_package_price < 0 then
      raise exception 'Quantidade e preço devem ser válidos.';
    end if;

    select p.id, p.name, p.base_unit, p.base_quantity_per_purchase_unit, p.storage_location
      into v_product
    from public.products p
    where p.id = (v_item->>'product_id')::uuid
      and p.household_id = p_household_id
      and p.is_active = true
    for update;
    if not found then
      raise exception 'Um dos produtos não existe ou está arquivado.';
    end if;

    v_base_quantity := v_quantity * v_product.base_quantity_per_purchase_unit;
    v_subtotal := v_subtotal + round(v_quantity * v_package_price, 2);

    insert into public.purchase_items (
      household_id, purchase_id, product_id, product_name_snapshot,
      quantity, unit, unit_price, total_price
    ) values (
      p_household_id, v_purchase_id, v_product.id, v_product.name,
      v_base_quantity, v_product.base_unit,
      v_package_price / v_product.base_quantity_per_purchase_unit,
      round(v_quantity * v_package_price, 2)
    ) returning id into v_purchase_item_id;

    perform public.add_stock_lot(
      p_household_id,
      v_product.id,
      v_base_quantity,
      v_product.base_unit,
      v_package_price / v_product.base_quantity_per_purchase_unit,
      v_expires_on,
      v_product.storage_location,
      'purchase',
      'entry'
    );

    insert into public.price_history (
      household_id, product_id, store_id, purchase_item_id,
      unit_price, unit, observed_at, source, created_by
    ) values (
      p_household_id, v_product.id, v_store_id, v_purchase_item_id,
      v_package_price / v_product.base_quantity_per_purchase_unit,
      v_product.base_unit, coalesce(p_purchased_at, now()), 'purchase', (select auth.uid())
    );
  end loop;

  if v_item_count = 0 then
    raise exception 'Adicione pelo menos um produto à compra.';
  end if;
  if coalesce(p_discount, 0) > v_subtotal then
    raise exception 'O desconto não pode ser maior que o subtotal.';
  end if;

  v_total := v_subtotal - coalesce(p_discount, 0);
  update public.purchases
  set subtotal = v_subtotal, total = v_total
  where id = v_purchase_id and household_id = p_household_id;

  if p_list_id is not null then
    update public.shopping_list_items sli
    set is_checked = true
    where sli.household_id = p_household_id
      and sli.list_id = p_list_id
      and sli.product_id in (
        select (value->>'product_id')::uuid from jsonb_array_elements(p_items)
      );
  end if;

  if nullif(trim(coalesce(p_receipt_storage_path, '')), '') is not null then
    insert into public.receipt_imports (
      household_id, storage_path, original_file_name, mime_type,
      status, purchase_id, uploaded_by
    ) values (
      p_household_id, p_receipt_storage_path,
      nullif(trim(coalesce(p_receipt_original_file_name, '')), ''),
      nullif(trim(coalesce(p_receipt_mime_type, '')), ''),
      'review', v_purchase_id, (select auth.uid())
    );
  end if;

  return v_purchase_id;
end;
$$;

revoke all on function public.sync_low_stock_shopping_list(uuid) from public;
revoke all on function public.confirm_household_purchase(uuid, uuid, text, timestamptz, numeric, text, jsonb, uuid, text, text, text) from public;
grant execute on function public.sync_low_stock_shopping_list(uuid) to authenticated;
grant execute on function public.confirm_household_purchase(uuid, uuid, text, timestamptz, numeric, text, jsonb, uuid, text, text, text) to authenticated;

-- Anexos de notas são privados e organizados por pasta da residência.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('purchase-receipts', 'purchase-receipts', false, 15728640, array['image/jpeg','image/png','image/webp','application/pdf']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists purchase_receipts_member_select on storage.objects;
create policy purchase_receipts_member_select on storage.objects
for select to authenticated
using (
  bucket_id = 'purchase-receipts'
  and public.is_household_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists purchase_receipts_member_insert on storage.objects;
create policy purchase_receipts_member_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'purchase-receipts'
  and public.is_household_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists purchase_receipts_member_delete on storage.objects;
create policy purchase_receipts_member_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'purchase-receipts'
  and public.is_household_member(((storage.foldername(name))[1])::uuid)
);

comment on function public.confirm_household_purchase(uuid, uuid, text, timestamptz, numeric, text, jsonb, uuid, text, text, text)
is 'Confirma uma compra de forma atômica, cria os lotes e movimentos de estoque e registra o histórico de preços.';
