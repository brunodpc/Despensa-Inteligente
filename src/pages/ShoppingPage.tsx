import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Check, CirclePlus, ClipboardList, Download, Minus, Plus, RefreshCw, Share2, ShoppingCart, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { notifyShoppingListChanged } from '../lib/events'
import { buildShoppingListPdf, downloadShoppingListPdf } from '../lib/shoppingListPdf'
import type { ShoppingPdfData, ShoppingPdfItem } from '../lib/shoppingListPdf'
import { addDemoStock, readDemoData, removeDemoListItem, saveDemoListItem, syncDemoLowStock, updateDemoBudget, updateDemoListItem, writeDemoData } from '../lib/demoData'
import type { BaseUnit, DemoProduct } from '../lib/demoData'

type Product = Pick<DemoProduct, 'id' | 'name' | 'brand' | 'base_unit' | 'purchase_unit_label' | 'base_quantity_per_purchase_unit' | 'current_stock' | 'minimum_stock' | 'target_stock'>
type ListRow = { id: string; product_id: string | null; custom_name: string | null; requested_quantity: number; unit: BaseUnit; estimated_unit_price: number | null; is_checked: boolean; source: string; created_at: string; product?: Product | null }
type List = { id: string; name: string; budget: number | null }
type Props = { householdId?: string; householdName?: string; demo?: boolean }

const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const unitName: Record<BaseUnit, string> = { g: 'g', ml: 'ml', un: 'un.' }

export function ShoppingPage({ householdId, householdName = 'Minha casa', demo = false }: Props) {
  const [list, setList] = useState<List | null>(null)
  const [items, setItems] = useState<ListRow[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [productId, setProductId] = useState('')
  const [customName, setCustomName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [customUnit, setCustomUnit] = useState<BaseUnit>('un')
  const [buyingNow, setBuyingNow] = useState(false)
  const [boughtExpiry, setBoughtExpiry] = useState('')
  const [budgetInput, setBudgetInput] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    if (demo) {
      const data = syncDemoLowStock(readDemoData())
      writeDemoData(data)
      setList(data.list)
      setProducts(data.products.filter(p => p.is_active))
      setItems(data.list.items.map(item => ({ ...item, product: data.products.find(p => p.id === item.product_id) ?? null })))
      setBudgetInput(data.list.budget === null ? '' : String(data.list.budget))
      setLoading(false)
      return
    }
    if (!supabase || !householdId) { setLoading(false); setError('Conecte o Supabase e selecione uma residência.'); return }
    const { data: listId, error: syncError } = await supabase.rpc('sync_low_stock_shopping_list', { p_household_id: householdId })
    if (syncError) { setError(syncError.message); setLoading(false); return }
    const [listResult, productResult] = await Promise.all([
      supabase.from('shopping_lists').select('id,name,budget').eq('household_id', householdId).eq('id', listId).single(),
      supabase.from('products').select('id,name,brand,base_unit,purchase_unit_label,base_quantity_per_purchase_unit,minimum_stock,target_stock').eq('household_id', householdId).eq('is_active', true).order('name'),
    ])
    if (listResult.error || productResult.error) { setError(listResult.error?.message ?? productResult.error?.message ?? 'Não foi possível carregar a lista.'); setLoading(false); return }
    const loadedList = listResult.data as List
    const productRows = (productResult.data ?? []) as Product[]
    const { data: itemRows, error: itemError } = await supabase.from('shopping_list_items').select('id,product_id,custom_name,requested_quantity,unit,estimated_unit_price,is_checked,source,created_at').eq('household_id', householdId).eq('list_id', loadedList.id).order('is_checked', { ascending: true }).order('created_at')
    if (itemError) { setError(itemError.message); setLoading(false); return }
    const productMap = new Map(productRows.map(p => [p.id, p]))
    setList(loadedList); setProducts(productRows)
    setItems(((itemRows ?? []) as Omit<ListRow, 'product'>[]).map(item => ({ ...item, product: item.product_id ? productMap.get(item.product_id) ?? null : null })))
    setBudgetInput(loadedList.budget === null ? '' : String(loadedList.budget))
    setLoading(false)
  }, [demo, householdId])

  useEffect(() => { void loadData() }, [loadData])

  const pendingItems = items.filter(item => !item.is_checked)
  const checkedItems = items.filter(item => item.is_checked)
  const estimatedTotal = items.reduce((sum, item) => sum + (Number(item.requested_quantity) * Number(item.estimated_unit_price ?? 0)), 0)

  function pdfItem(item: ListRow): ShoppingPdfItem {
    const product = item.product
    const purchaseQty = Number(item.requested_quantity) / (product?.base_quantity_per_purchase_unit ?? 1)
    const label = product?.purchase_unit_label ?? unitName[item.unit]
    const details = [item.source === 'low_stock' ? 'Reposição automática pelo estoque' : 'Adicionado à lista']
    if (product?.brand) details.push(product.brand)
    if (item.estimated_unit_price !== null) details.push(`${currency(Number(item.estimated_unit_price) * (product?.base_quantity_per_purchase_unit ?? 1))}/${label}`)
    return {
      name: product?.name ?? item.custom_name ?? 'Produto',
      quantityLabel: `${purchaseQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${label}`,
      detail: details.join(' · '),
      priceLabel: item.estimated_unit_price === null ? undefined : currency(purchaseQty * Number(item.estimated_unit_price) * (product?.base_quantity_per_purchase_unit ?? 1)),
      checked: item.is_checked,
    }
  }

  function pdfData(): ShoppingPdfData {
    return {
      householdName,
      listName: list?.name ?? 'Lista de compras',
      pending: pendingItems.map(pdfItem),
      checked: checkedItems.map(pdfItem),
      estimatedTotalLabel: currency(estimatedTotal),
      budgetLabel: budgetInput.trim() ? currency(Number(budgetInput)) : undefined,
    }
  }

  function handleDownloadPdf() {
    downloadShoppingListPdf(pdfData())
    setNotice('PDF baixado. Você pode abrir, imprimir ou enviar sem internet.')
  }

  async function handleSharePdf() {
    const file = new File([buildShoppingListPdf(pdfData())], `lista-de-compras-${new Date().toISOString().slice(0, 10)}.pdf`, { type: 'application/pdf' })
    const share = navigator.share?.bind(navigator)
    if (share && navigator.canShare?.({ files: [file] })) {
      try {
        await share({ files: [file], title: 'Lista de compras', text: 'Lista de compras da despensa inteligente' })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    downloadShoppingListPdf(pdfData())
    setNotice('Compartilhamento indisponível aqui; o PDF foi baixado para você enviar.')
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!list) return
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) { setError('Informe uma quantidade maior que zero.'); return }
    if (!productId && !customName.trim()) { setError('Selecione um produto ou informe um nome personalizado.'); return }
    if (buyingNow && !productId) { setError('Para atualizar a despensa, escolha um produto cadastrado.'); return }
    const purchaseNow = buyingNow && !!productId
    setSaving(true); setError(''); setNotice('')
    let completed = false
    if (demo) {
      let data = saveDemoListItem({ productId: productId || undefined, customName: customName || undefined, quantity: qty, unit: customUnit })
      if (purchaseNow) {
        const added = data.list.items.find(item => item.product_id === productId)
        if (added) data = updateDemoListItem(added.id, { is_checked: true })
        const conversion = products.find(p => p.id === productId)?.base_quantity_per_purchase_unit ?? 1
        data = addDemoStock({ productId, quantity: qty * conversion, expiresOn: boughtExpiry || undefined })
      }
      setItems(data.list.items.map(item => ({ ...item, product: data.products.find(p => p.id === item.product_id) ?? null })))
      setProducts(data.products.filter(p => p.is_active))
      setNotice(purchaseNow ? 'Item adicionado, marcado como comprado e estoque atualizado nesta prévia.' : 'Item adicionado à lista compartilhável desta prévia.')
      completed = true
    } else if (supabase && householdId) {
      const product = products.find(p => p.id === productId)
      const baseQuantity = qty * (product?.base_quantity_per_purchase_unit ?? 1)
      let stockError = ''
      if (product) {
        const existing = items.find(item => item.product_id === product.id)
        if (existing) {
          const { error: updateError } = await supabase.from('shopping_list_items').update({ requested_quantity: baseQuantity, is_checked: purchaseNow, source: 'manual' }).eq('id', existing.id).eq('household_id', householdId)
          if (updateError) setError(updateError.message)
          else completed = true
        } else {
          const { error: insertError } = await supabase.from('shopping_list_items').insert({ household_id: householdId, list_id: list.id, product_id: product.id, requested_quantity: baseQuantity, unit: product.base_unit, is_checked: purchaseNow, source: 'manual' })
          if (insertError) setError(insertError.message)
          else completed = true
        }
        if (completed && purchaseNow) {
          const { error: entryError } = await supabase.rpc('add_stock_lot', {
            p_household_id: householdId,
            p_product_id: product.id,
            p_quantity: baseQuantity,
            p_unit: product.base_unit,
            p_unit_cost: null,
            p_expires_on: boughtExpiry || null,
            p_storage_location: null,
            p_source: 'purchase',
            p_movement_type: 'entry',
          })
          if (entryError) stockError = entryError.message
        }
      } else {
        const { error: insertError } = await supabase.from('shopping_list_items').insert({ household_id: householdId, list_id: list.id, custom_name: customName.trim(), requested_quantity: qty, unit: customUnit, source: 'manual' })
        if (insertError) setError(insertError.message)
        else completed = true
      }
      if (completed) {
        await loadData()
        if (stockError) setError(`Item salvo na lista, mas o estoque não foi atualizado: ${stockError}`)
        else setNotice(purchaseNow ? 'Item adicionado, marcado como comprado e estoque atualizado.' : product ? 'Produto adicionado à lista.' : 'Item personalizado adicionado.')
      }
    }
    if (completed) { setProductId(''); setCustomName(''); setQuantity('1'); setBuyingNow(false); setBoughtExpiry(''); notifyShoppingListChanged() }
    setSaving(false)
  }

  async function toggleItem(item: ListRow) {
    const next = !item.is_checked
    if (demo) {
      const data = updateDemoListItem(item.id, { is_checked: next })
      setItems(data.list.items.map(row => ({ ...row, product: data.products.find(p => p.id === row.product_id) ?? null })))
      notifyShoppingListChanged()
    } else if (supabase && householdId) {
      const { error: updateError } = await supabase.from('shopping_list_items').update({ is_checked: next }).eq('id', item.id).eq('household_id', householdId)
      if (updateError) setError(updateError.message)
      else { setItems(current => current.map(row => row.id === item.id ? { ...row, is_checked: next } : row)); notifyShoppingListChanged() }
    }
  }

  async function changeQuantity(item: ListRow, delta: number) {
    const conversion = item.product?.base_quantity_per_purchase_unit ?? (item.unit === 'un' ? 1 : 100)
    const nextBase = Math.max(conversion, Number(item.requested_quantity) + delta * conversion)
    if (demo) {
      const data = updateDemoListItem(item.id, { requested_quantity: nextBase })
      setItems(data.list.items.map(row => ({ ...row, product: data.products.find(p => p.id === row.product_id) ?? null })))
      notifyShoppingListChanged()
    } else if (supabase && householdId) {
      const { error: updateError } = await supabase.from('shopping_list_items').update({ requested_quantity: nextBase }).eq('id', item.id).eq('household_id', householdId)
      if (updateError) setError(updateError.message)
      else { setItems(current => current.map(row => row.id === item.id ? { ...row, requested_quantity: nextBase } : row)); notifyShoppingListChanged() }
    }
  }

  async function deleteItem(item: ListRow) {
    if (!window.confirm(`Remover ${item.product?.name ?? item.custom_name ?? 'este item'} da lista?`)) return
    if (demo) {
      const data = removeDemoListItem(item.id)
      setItems(data.list.items.map(row => ({ ...row, product: data.products.find(p => p.id === row.product_id) ?? null })))
      notifyShoppingListChanged()
    } else if (supabase && householdId) {
      const { error: deleteError } = await supabase.from('shopping_list_items').delete().eq('id', item.id).eq('household_id', householdId)
      if (deleteError) setError(deleteError.message)
      else { setItems(current => current.filter(row => row.id !== item.id)); notifyShoppingListChanged() }
    }
  }

  async function saveBudget() {
    const budget = budgetInput.trim() ? Number(budgetInput) : null
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) { setError('Informe um orçamento válido.'); return }
    if (demo) { updateDemoBudget(budget); setList(current => current ? { ...current, budget } : current); setNotice('Orçamento salvo na prévia local.') }
    else if (supabase && householdId && list) {
      const { error: updateError } = await supabase.from('shopping_lists').update({ budget }).eq('id', list.id).eq('household_id', householdId)
      if (updateError) setError(updateError.message)
      else { setList({ ...list, budget }); setNotice('Orçamento atualizado.') }
    }
  }

  const renderItem = (item: ListRow) => {
    const product = item.product
    const purchaseQty = Number(item.requested_quantity) / (product?.base_quantity_per_purchase_unit ?? 1)
    const label = product?.purchase_unit_label ?? unitName[item.unit]
    const price = Number(item.estimated_unit_price ?? 0) * (product?.base_quantity_per_purchase_unit ?? 1)
    return <article className={`commerce-item ${item.is_checked ? 'is-done' : ''}`} key={item.id}>
      <button className={`commerce-check ${item.is_checked ? 'checked' : ''}`} onClick={() => void toggleItem(item)} aria-label={item.is_checked ? 'Desmarcar item' : 'Marcar item'}>{item.is_checked && <Check size={14}/>}</button>
      <div className="commerce-item-main"><strong>{product?.name ?? item.custom_name ?? 'Produto'}</strong><small>{item.source === 'low_stock' ? 'Reposição automática pelo estoque' : 'Adicionado à lista'}{product?.brand ? ` · ${product.brand}` : ''}</small></div>
      <div className="commerce-quantity-control"><button onClick={() => void changeQuantity(item, -1)} disabled={purchaseQty <= 1} aria-label="Diminuir quantidade"><Minus size={13}/></button><strong>{purchaseQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong><button onClick={() => void changeQuantity(item, 1)} aria-label="Aumentar quantidade"><Plus size={13}/></button></div>
      <div className="commerce-item-price"><strong>{item.estimated_unit_price === null ? '—' : currency(price * purchaseQty)}</strong><small>{label}{item.estimated_unit_price === null ? ' · sem estimativa' : ` · ${currency(price)}/un.`}</small></div>
      <button className="commerce-icon-button" onClick={() => void deleteItem(item)} aria-label="Remover item"><Trash2 size={15}/></button>
    </article>
  }

  return <div className="module-page">
    <div className="page-heading-row module-heading"><div><span className="eyebrow">PLANEJAMENTO DA CASA</span><h1>Lista de compras <span>🛒</span></h1><p>Uma lista compartilhada, alimentada pelo estoque e atualizada pelos moradores.</p></div><div className="module-heading-actions"><button className="button button-outline" onClick={() => void loadData()} disabled={loading}><RefreshCw size={15}/> Atualizar</button><button className="button button-outline" onClick={() => void handleSharePdf()} disabled={loading}><Share2 size={15}/> Compartilhar</button><button className="button button-primary" onClick={handleDownloadPdf} disabled={loading}><Download size={15}/> Baixar PDF</button><Link className="button button-outline" to="/modo-mercado"><ShoppingCart size={15}/> Ir ao mercado</Link></div></div>
    {demo && <div className="demo-callout"><ClipboardList size={17}/><span><strong>Prévia interativa.</strong> As alterações ficam salvas neste navegador e não são sincronizadas com outros dispositivos até conectar o Supabase.</span></div>}
    <div className="settings-note commerce-alert"><Download size={15}/><span>O PDF funciona sem internet: baixe ou compartilhe antes de ir ao mercado. Ele também serve para quem for fazer a compra por você.</span></div>
    {error && <div className="form-alert error commerce-alert">{error}</div>}{notice && <div className="form-alert success commerce-alert">{notice}</div>}
    <section className="commerce-metrics"><article className="metric-card"><div className="metric-top"><span>Itens pendentes</span><ShoppingCart size={17}/></div><div className="metric-value">{pendingItems.length}</div><div className="metric-foot">Precisam entrar no carrinho</div></article><article className="metric-card"><div className="metric-top"><span>Já separados</span><Check size={17}/></div><div className="metric-value">{checkedItems.length}</div><div className="metric-foot">Marcados durante a compra</div></article><article className="metric-card"><div className="metric-top"><span>Estimativa registrada</span><span className="metric-icon icon-blue">R$</span></div><div className="metric-value commerce-money">{currency(estimatedTotal)}</div><div className="metric-foot">Itens com preço informado</div></article></section>
    <div className="commerce-layout">
      <section className="panel commerce-panel"><div className="panel-heading"><div><h2>{list?.name ?? 'Compras da casa'}</h2><p>Produtos que precisam ser comprados e itens adicionados manualmente.</p></div><span className="commerce-count">{items.length} itens</span></div>
        <div className="commerce-list-section"><div className="commerce-section-label"><strong>Pendentes</strong><span>{pendingItems.length}</span></div>{loading ? <div className="commerce-empty">Carregando lista...</div> : pendingItems.length ? pendingItems.map(renderItem) : <div className="commerce-empty">Nenhum item pendente. O estoque está em dia ou todos os produtos já foram separados.</div>}
          {checkedItems.length > 0 && <><div className="commerce-section-label checked-label"><strong>Separados no carrinho</strong><span>{checkedItems.length}</span></div>{checkedItems.map(renderItem)}</>}
        </div>
      </section>
      <aside className="panel commerce-side"><div className="panel-heading"><div><h2>Adicionar à lista</h2><p>Produto cadastrado ou item avulso.</p></div><CirclePlus size={18}/></div>
        <form className="commerce-form" onSubmit={addItem}><label>Produto cadastrado<select className="text-input" value={productId} onChange={event => { setProductId(event.target.value); setCustomName('') }}><option value="">Escolher produto...</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><div className="commerce-or">ou adicione um item que ainda não está no catálogo</div><label>Nome personalizado<input className="text-input" value={customName} onChange={event => { setCustomName(event.target.value); setProductId(''); setBuyingNow(false) }} placeholder="Ex.: Guardanapo"/></label><label className={`commerce-buy-now ${productId ? '' : 'is-disabled'}`}><input type="checkbox" checked={buyingNow} disabled={!productId} onChange={event => setBuyingNow(event.target.checked)}/><span><strong>Estou comprando agora</strong><small>Entra na despensa e o item já fica marcado como comprado.</small></span></label>{buyingNow && !productId && <small className="commerce-hint">Escolha um produto cadastrado para atualizar o estoque.</small>}{buyingNow && <label>Validade do lote (opcional)<input className="text-input" type="date" value={boughtExpiry} onChange={event => setBoughtExpiry(event.target.value)}/></label>}<div className="commerce-form-row"><label>{buyingNow ? 'Quantidade comprada agora' : 'Quantidade'}<input className="text-input" type="number" min="0.01" step="0.01" value={quantity} onChange={event => setQuantity(event.target.value)} required/></label>{!productId && <label>Unidade<select className="text-input" value={customUnit} onChange={event => setCustomUnit(event.target.value as BaseUnit)}><option value="un">Unidade</option><option value="g">Gramas</option><option value="ml">Mililitros</option></select></label>}</div><button className="button button-primary full-button" disabled={saving || loading}><Plus size={15}/>{saving ? 'Adicionando...' : 'Adicionar item'}</button></form>
        <div className="commerce-budget"><div className="panel-heading"><div><h2>Orçamento da lista</h2><p>Usado também no modo mercado.</p></div></div><div className="commerce-budget-row"><label className="sr-only" htmlFor="shopping-budget">Orçamento em reais</label><span>R$</span><input id="shopping-budget" className="text-input" type="number" min="0" step="0.01" value={budgetInput} onChange={event => setBudgetInput(event.target.value)} placeholder="Defina um limite"/><button className="button button-outline" onClick={() => void saveBudget()}>Salvar</button></div><div className="commerce-budget-foot"><span>Estimativa de itens precificados</span><strong>{currency(estimatedTotal)}</strong></div></div>
        <div className="commerce-side-links"><Link to="/registrar-compra">Registrar uma compra <ArrowRight size={14}/></Link><Link to="/precos">Consultar histórico de preços <ArrowRight size={14}/></Link></div>
      </aside>
    </div>
    {loading && <div className="pantry-loading-footnote"><RefreshCw className="spin" size={14}/> Atualizando lista...</div>}
  </div>
}
