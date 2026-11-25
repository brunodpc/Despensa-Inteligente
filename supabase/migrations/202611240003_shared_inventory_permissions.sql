-- Despensa Inteligente | Sprint 03
-- Todos os membros da residência possuem as mesmas permissões operacionais.
-- Somente owner/admin continuam autorizados a gerenciar a residência e os convites.

-- Produtos: membros podem consultar e editar; criação passa por RPC transacional
-- e exclusão física não é permitida (usar is_active = false para arquivar).
drop policy if exists products_member_all on public.products;
create policy products_member_read on public.products
  for select to authenticated
  using (public.is_household_member(household_id));
create policy products_member_update on public.products
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

revoke insert, delete on public.products from authenticated;
grant select, update on public.products to authenticated;

-- Cria o produto e, opcionalmente, seu primeiro lote em uma única transação.
-- Isso evita deixar produtos parcialmente cadastrados caso a entrada inicial falhe.
create or replace function public.create_product_with_stock(
  p_household_id uuid,
  p_name text,
  p_category_id uuid,
  p_brand text,
  p_barcode text,
  p_base_unit text,
  p_purchase_unit_label text,
  p_base_quantity_per_purchase_unit numeric,
  p_minimum_stock numeric,
  p_target_stock numeric,
  p_storage_location text,
  p_notes text,
  p_initial_quantity numeric default 0,
  p_initial_unit_cost numeric default null,
  p_initial_expires_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_product_id uuid;
begin
  if v_user_id is null or not public.is_household_member(p_household_id) then
    raise exception 'Acesso não autorizado a esta residência.' using errcode = '42501';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 1 and 120 then
    raise exception 'O nome do produto deve ter entre 1 e 120 caracteres.' using errcode = '22023';
  end if;
  if p_base_unit not in ('g', 'ml', 'un') then
    raise exception 'Unidade-base inválida. Utilize g, ml ou un.' using errcode = '22023';
  end if;
  if p_purchase_unit_label is null or char_length(trim(p_purchase_unit_label)) not between 1 and 60 then
    raise exception 'Informe uma unidade de compra entre 1 e 60 caracteres.' using errcode = '22023';
  end if;
  if p_base_quantity_per_purchase_unit is null or p_base_quantity_per_purchase_unit <= 0 then
    raise exception 'A conversão da unidade de compra deve ser maior que zero.' using errcode = '22023';
  end if;
  if p_minimum_stock is null or p_minimum_stock < 0
     or p_target_stock is null or p_target_stock < p_minimum_stock then
    raise exception 'Confira os níveis mínimo e desejado do estoque.' using errcode = '22023';
  end if;
  if p_initial_quantity is null or p_initial_quantity < 0 then
    raise exception 'A quantidade inicial não pode ser negativa.' using errcode = '22023';
  end if;
  if p_initial_unit_cost is not null and p_initial_unit_cost < 0 then
    raise exception 'O custo unitário não pode ser negativo.' using errcode = '22023';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.categories c where c.id = p_category_id
  ) then
    raise exception 'Categoria não encontrada.' using errcode = '22023';
  end if;

  insert into public.products (
    household_id, category_id, name, brand, barcode, base_unit,
    purchase_unit_label, base_quantity_per_purchase_unit,
    minimum_stock, target_stock, storage_location, notes, created_by
  ) values (
    p_household_id, p_category_id, trim(p_name), nullif(trim(coalesce(p_brand, '')), ''),
    nullif(trim(coalesce(p_barcode, '')), ''), p_base_unit,
    trim(p_purchase_unit_label), p_base_quantity_per_purchase_unit,
    p_minimum_stock, p_target_stock, nullif(trim(coalesce(p_storage_location, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''), v_user_id
  ) returning id into v_product_id;

  if p_initial_quantity > 0 then
    perform public.add_stock_lot(
      p_household_id,
      v_product_id,
      p_initial_quantity,
      p_base_unit,
      p_initial_unit_cost,
      p_initial_expires_on,
      p_storage_location,
      'manual',
      'entry'
    );
  end if;

  return v_product_id;
end;
$$;

revoke all on function public.create_product_with_stock(
  uuid, text, uuid, text, text, text, text, numeric, numeric, numeric,
  text, text, numeric, numeric, date
) from public, anon;
grant execute on function public.create_product_with_stock(
  uuid, text, uuid, text, text, text, text, numeric, numeric, numeric,
  text, text, numeric, numeric, date
) to authenticated;

comment on function public.create_product_with_stock(
  uuid, text, uuid, text, text, text, text, numeric, numeric, numeric,
  text, text, numeric, numeric, date
) is 'Cria produto e primeiro lote atomicamente para qualquer membro da residência.';

comment on table public.products is 'Catálogo de produtos da residência. Todos os membros podem editar; arquivamento é lógico via is_active.';
comment on table public.stock_lots is 'Lotes de estoque; alterações somente por RPCs transacionais.';
comment on table public.stock_movements is 'Livro-razão imutável de entradas, consumo, perdas e ajustes.';

-- Permissões operacionais uniformes: owner, admin e member podem operar os dados
-- da própria residência. A condição de cada policy sempre valida o household_id.
drop policy if exists stores_member_all on public.stores;
create policy stores_shared_all on public.stores for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists shopping_lists_member_all on public.shopping_lists;
create policy shopping_lists_shared_all on public.shopping_lists for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists shopping_items_member_all on public.shopping_list_items;
create policy shopping_items_shared_all on public.shopping_list_items for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists purchases_member_all on public.purchases;
create policy purchases_shared_all on public.purchases for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists purchase_items_member_all on public.purchase_items;
create policy purchase_items_shared_all on public.purchase_items for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists price_history_member_all on public.price_history;
create policy price_history_shared_all on public.price_history for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists receipt_imports_member_all on public.receipt_imports;
create policy receipt_imports_shared_all on public.receipt_imports for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

comment on policy stores_shared_all on public.stores is 'Todos os membros podem cadastrar e editar estabelecimentos da própria residência.';
comment on policy shopping_lists_shared_all on public.shopping_lists is 'Todos os membros podem gerenciar listas da própria residência.';
comment on policy shopping_items_shared_all on public.shopping_list_items is 'Todos os membros podem gerenciar itens das listas da própria residência.';
comment on policy purchases_shared_all on public.purchases is 'Todos os membros podem registrar e editar compras da própria residência.';
comment on policy purchase_items_shared_all on public.purchase_items is 'Todos os membros podem gerenciar itens das compras da própria residência.';
comment on policy price_history_shared_all on public.price_history is 'Todos os membros podem registrar e consultar preços da própria residência.';
comment on policy receipt_imports_shared_all on public.receipt_imports is 'Todos os membros podem importar e revisar notas da própria residência.';
