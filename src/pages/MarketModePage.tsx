import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, CreditCard, Minus, Plus, RefreshCw, ShoppingBasket, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { readDemoData, updateDemoBudget, updateDemoListItem } from '../lib/demoData'
import type { BaseUnit, DemoProduct } from '../lib/demoData'

type Product = Pick<DemoProduct, 'id' | 'name' | 'purchase_unit_label' | 'base_quantity_per_purchase_unit' | 'base_unit'>
type Item = { id: string; product_id: string | null; custom_name: string | null; requested_quantity: number; unit: BaseUnit; estimated_unit_price: number | null; is_checked: boolean; product: Product | null }
type Props = { householdId?: string; demo?: boolean }
const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export function MarketModePage({ householdId, demo = false }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [listId, setListId] = useState('')
  const [budget, setBudget] = useState('')
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    if (demo) {
      const data = readDemoData()
      setListId(data.list.id)
      setBudget(data.list.budget === null ? '' : String(data.list.budget))
      const loaded = data.list.items.map(item => ({ ...item, product: data.products.find(product => product.id === item.product_id) ?? null }))
      setItems(loaded)
      setPrices(Object.fromEntries(loaded.map(item => [item.id, item.estimated_unit_price === null ? '' : String(item.estimated_unit_price * (item.product?.base_quantity_per_purchase_unit ?? 1))])))
      setQuantities(Object.fromEntries(loaded.map(item => [item.id, String(item.requested_quantity / (item.product?.base_quantity_per_purchase_unit ?? 1))])))
      setLoading(false); return
    }
    if (!supabase || !householdId) { setError('Conecte o Supabase para carregar o carrinho.'); setLoading(false); return }
    const { data: activeListId, error: syncError } = await supabase.rpc('sync_low_stock_shopping_list', { p_household_id: householdId })
    if (syncError) { setError(syncError.message); setLoading(false); return }
    setListId(activeListId as string)
    const [listResult, productResult, itemResult] = await Promise.all([
      supabase.from('shopping_lists').select('id,budget').eq('id', activeListId).eq('household_id', householdId).single(),
      supabase.from('products').select('id,name,purchase_unit_label,base_quantity_per_purchase_unit,base_unit').eq('household_id', householdId).eq('is_active', true),
      supabase.from('shopping_list_items').select('id,product_id,custom_name,requested_quantity,unit,estimated_unit_price,is_checked').eq('household_id', householdId).eq('list_id', activeListId).order('created_at'),
    ])
    const issue = listResult.error ?? productResult.error ?? itemResult.error
    if (issue || !listResult.data) {
      setError(issue?.message ?? 'Não foi possível localizar a lista ativa de compras.')
      setLoading(false)
      return
    }
    const activeList = listResult.data
    const productMap = new Map(((productResult.data ?? []) as Product[]).map(product => [product.id, product]))
    const loaded = ((itemResult.data ?? []) as Omit<Item, 'product'>[]).map(item => ({ ...item, product: item.product_id ? productMap.get(item.product_id) ?? null : null }))
    setBudget(activeList.budget === null ? '' : String(activeList.budget)); setItems(loaded)
    setPrices(Object.fromEntries(loaded.map(item => [item.id, item.estimated_unit_price === null ? '' : String(item.estimated_unit_price * (item.product?.base_quantity_per_purchase_unit ?? 1))])))
    setQuantities(Object.fromEntries(loaded.map(item => [item.id, String(item.requested_quantity / (item.product?.base_quantity_per_purchase_unit ?? 1))])))
    setLoading(false)
  }, [demo, householdId])

  useEffect(() => { void loadData() }, [loadData])

  const cartItems = items.filter(item => item.is_checked)
  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + Number(quantities[item.id] ?? 0) * Number(prices[item.id] ?? 0), 0), [cartItems, quantities, prices])
  const budgetValue = Number(budget) || 0
  const remaining = budgetValue - subtotal

  async function toggle(item: Item) {
    const next = !item.is_checked
    if (demo) {
      const data = updateDemoListItem(item.id, { is_checked: next })
      setItems(data.list.items.map(row => ({ ...row, product: data.products.find(p => p.id === row.product_id) ?? null })))
      return
    }
    if (!supabase || !householdId) return
    const { error: updateError } = await supabase.from('shopping_list_items').update({ is_checked: next }).eq('id', item.id).eq('household_id', householdId)
    if (updateError) setError(updateError.message)
    else setItems(current => current.map(row => row.id === item.id ? { ...row, is_checked: next } : row))
  }

  async function saveItem(item: Item) {
    const price = Number(prices[item.id])
    const qty = Number(quantities[item.id])
    if (!Number.isFinite(qty) || qty <= 0 || (prices[item.id]?.trim() && (!Number.isFinite(price) || price < 0))) { setError('Confira a quantidade e o preço.'); return }
    const conversion = item.product?.base_quantity_per_purchase_unit ?? 1
    const basePrice = prices[item.id]?.trim() ? price / conversion : null
    if (demo) {
      const data = updateDemoListItem(item.id, { requested_quantity: qty * conversion, estimated_unit_price: basePrice })
      setItems(data.list.items.map(row => ({ ...row, product: data.products.find(p => p.id === row.product_id) ?? null })))
      setNotice('Item atualizado no carrinho desta prévia.')
      return
    }
    if (!supabase || !householdId) return
    const { error: updateError } = await supabase.from('shopping_list_items').update({ requested_quantity: qty * conversion, estimated_unit_price: basePrice }).eq('id', item.id).eq('household_id', householdId)
    if (updateError) setError(updateError.message)
    else { setItems(current => current.map(row => row.id === item.id ? { ...row, requested_quantity: qty * conversion, estimated_unit_price: basePrice } : row)); setNotice('Quantidade e preço estimado salvos.') }
  }

  async function saveBudget() {
    const value = budget.trim() ? Number(budget) : null
    if (value !== null && (!Number.isFinite(value) || value < 0)) { setError('Informe um orçamento válido.'); return }
    if (demo) { updateDemoBudget(value); setNotice('Orçamento salvo nesta prévia.'); return }
    if (!supabase || !householdId || !listId) return
    const { error: updateError } = await supabase.from('shopping_lists').update({ budget: value }).eq('id', listId).eq('household_id', householdId)
    if (updateError) setError(updateError.message)
    else setNotice('Orçamento salvo.')
  }

  return <div className="module-page market-page">
    <div className="page-heading-row module-heading"><div><span className="eyebrow">DURANTE AS COMPRAS</span><h1>Modo mercado <span>🧺</span></h1><p>Use o celular para acompanhar o carrinho e controlar o valor da compra em tempo real.</p></div><Link className="button button-outline" to="/compras">Voltar à lista <ArrowRight size={15}/></Link></div>
    {demo && <div className="demo-callout"><ShoppingBasket size={17}/><span><strong>Modo demonstração interativo.</strong> Quantidades, preços e orçamento ficam salvos neste navegador.</span></div>}
    {error && <div className="form-alert error commerce-alert">{error}</div>}{notice && <div className="form-alert success commerce-alert">{notice}</div>}
    <section className="market-summary panel"><div><span className="eyebrow">TOTAL DO CARRINHO</span><div className="market-total">{currency(subtotal)}</div><small>{cartItems.length} de {items.length} itens selecionados</small></div><div className="market-budget-summary"><div className="market-budget-edit"><label htmlFor="market-budget">Orçamento</label><div><span>R$</span><input id="market-budget" type="number" min="0" step="0.01" value={budget} onChange={event => setBudget(event.target.value)} placeholder="Sem limite"/><button onClick={() => void saveBudget()}>Salvar</button></div></div><div className={`market-remaining ${budgetValue > 0 && remaining < 0 ? 'over' : ''}`}><span>{budgetValue > 0 ? remaining >= 0 ? 'Ainda disponível' : 'Acima do orçamento' : 'Defina um orçamento'}</span><strong>{budgetValue > 0 ? currency(Math.abs(remaining)) : '—'}</strong></div></div></section>
    {budgetValue > 0 && <div className="market-progress"><div style={{ width: `${Math.min(100, subtotal / budgetValue * 100)}%` }}/></div>}
    <section className="panel market-items-panel"><div className="panel-heading"><div><h2>Lista para conferir no mercado</h2><p>Marque o produto ao colocá-lo no carrinho e informe o preço encontrado.</p></div><button className="button button-outline" onClick={() => void loadData()} disabled={loading}><RefreshCw size={14}/> Atualizar</button></div>
      {loading ? <div className="commerce-empty">Carregando itens...</div> : items.length === 0 ? <div className="commerce-empty"><ShoppingBasket size={24}/><strong>Seu carrinho está vazio.</strong><span>Adicione produtos pela lista de compras antes de ir ao mercado.</span><Link className="button button-primary" to="/compras">Abrir lista de compras</Link></div> : <div className="market-item-list">{items.map(item => {
        const unitLabel = item.unit === 'g' ? 'grama' : item.unit === 'ml' ? 'ml' : 'unidade'
        const label = item.product?.purchase_unit_label ?? unitLabel
        return <article className={`market-item ${item.is_checked ? 'in-cart' : ''}`} key={item.id}>
          <button className={`commerce-check ${item.is_checked ? 'checked' : ''}`} onClick={() => void toggle(item)} aria-label={item.is_checked ? 'Tirar do carrinho' : 'Adicionar ao carrinho'}>{item.is_checked && <Check size={14}/>}</button>
          <div className="market-item-name"><strong>{item.product?.name ?? item.custom_name ?? 'Item'}</strong><small>{item.product ? label : `Item avulso · ${item.unit}`}</small></div>
          <div className="market-edit-field"><label>Qtd.</label><div className="market-number-wrap"><button aria-label="Diminuir quantidade" onClick={() => setQuantities(current => ({ ...current, [item.id]: String(Math.max(item.unit === 'un' ? 1 : 0.01, Number(current[item.id] ?? 1) - (item.unit === 'un' ? 1 : item.product?.base_quantity_per_purchase_unit ? 1 : 100))) }))}><Minus size={12}/></button><input type="number" min="0.01" step="0.01" value={quantities[item.id] ?? '1'} onChange={event => setQuantities(current => ({ ...current, [item.id]: event.target.value }))}/><button aria-label="Aumentar quantidade" onClick={() => setQuantities(current => ({ ...current, [item.id]: String(Number(current[item.id] ?? 0) + (item.product?.base_quantity_per_purchase_unit ? 1 : item.unit === 'un' ? 1 : 100)) }))}><Plus size={12}/></button></div></div>
          <div className="market-edit-field"><label>Preço por {label}</label><div className="market-price-wrap"><span>R$</span><input type="number" min="0" step="0.01" value={prices[item.id] ?? ''} onChange={event => setPrices(current => ({ ...current, [item.id]: event.target.value }))} placeholder="0,00"/></div></div>
          <div className="market-line-total"><small>Total</small><strong>{currency(Number(quantities[item.id] ?? 0) * Number(prices[item.id] ?? 0))}</strong><button onClick={() => void saveItem(item)}>Salvar</button></div>
        </article>
      })}</div>}
    </section>
    <div className="market-bottom-actions"><div><Wallet size={18}/><span>O preço informado será usado para atualizar sua referência de compra e apoiar comparações futuras.</span></div><Link className="button button-primary" to="/registrar-compra"><CreditCard size={15}/> Registrar compra finalizada</Link></div>
  </div>
}
