import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, ArrowRight, CalendarDays, Check, CircleAlert, Clock3,
  LoaderCircle, Package, Plus, Receipt, ShoppingBasket, Sparkles, TrendingDown,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { readAppPreferences } from '../lib/appPreferences'
import { readDemoData } from '../lib/demoData'

type DashboardProduct = { id: string; name: string; category_id: string | null; base_unit: 'g' | 'ml' | 'un'; minimum_stock: number; target_stock: number; purchase_unit_label: string; base_quantity_per_purchase_unit: number }
type DashboardLot = { product_id: string; remaining_quantity: number; expires_on: string | null }
type DashboardItem = { id: string; product_id: string | null; custom_name: string | null; requested_quantity: number; unit: string; is_checked: boolean }
type DashboardMovement = { id: string; product_id: string; movement_type: 'entry' | 'consumption' | 'loss' | 'adjustment'; quantity_delta: number; unit: string; note: string | null; created_at: string }
type LowStockItem = { id: string; name: string; category: string; quantity: string }
type RecentItem = { id: string; title: string; detail: string; time: string; tone: string; icon: typeof Package }
type DashboardData = {
  productCount: number
  lowStockCount: number
  expiringCount: number
  monthlySpend: number
  lowStock: LowStockItem[]
  listName: string | null
  pendingCount: number
  listItems: Array<{ id: string; name: string; quantity: string }>
  recent: RecentItem[]
}

const emptyDashboard: DashboardData = { productCount: 0, lowStockCount: 0, expiringCount: 0, monthlySpend: 0, lowStock: [], listName: null, pendingCount: 0, listItems: [], recent: [] }
function createDemoDashboard(expiryAlertDays: number): DashboardData {
  const demo = readDemoData()
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const activeProducts = demo.products.filter(product => product.is_active)
  const lowProducts = activeProducts.filter(product => product.minimum_stock > 0 && product.current_stock <= product.minimum_stock)
  const pending = demo.list.items.filter(item => !item.is_checked)
  const currentMonthPurchases = demo.purchases.filter(purchase => {
    const date = new Date(purchase.purchased_at)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === currentMonth
  })
  const recent: RecentItem[] = demo.purchases.slice(0, 4).map(purchase => ({
    id: purchase.id,
    title: 'Compra registrada',
    detail: `${purchase.store_name} · ${purchase.items.length} ${purchase.items.length === 1 ? 'produto' : 'produtos'} · ${formatCurrency(purchase.total)}`,
    time: relativeDate(purchase.purchased_at),
    tone: 'blue',
    icon: Receipt,
  }))
  return {
    productCount: activeProducts.length,
    lowStockCount: lowProducts.length,
    expiringCount: activeProducts.filter(product => product.next_expiry && dayDifference(product.next_expiry) >= 0 && dayDifference(product.next_expiry) <= expiryAlertDays).length,
    monthlySpend: currentMonthPurchases.reduce((sum, purchase) => sum + purchase.total, 0),
    lowStock: lowProducts.slice(0, 4).map(product => ({
      id: product.id,
      name: product.name,
      category: product.category_name || 'Sem categoria',
      quantity: formatQuantity(product.current_stock, product.base_unit),
    })),
    listName: demo.list.name,
    pendingCount: pending.length,
    listItems: pending.slice(0, 3).map(item => {
      const product = item.product_id ? activeProducts.find(row => row.id === item.product_id) : null
      const packQuantity = item.requested_quantity / (product?.base_quantity_per_purchase_unit ?? 1)
      const unitLabel = product?.purchase_unit_label ?? item.unit
      return { id: item.id, name: product?.name ?? item.custom_name ?? 'Produto', quantity: `${formatDecimal(packQuantity)} ${unitLabel}` }
    }),
    recent,
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
function formatQuantity(value: number, unit: string) {
  if (unit === 'g' && value >= 1000) return `${formatDecimal(value / 1000)} kg`
  if (unit === 'ml' && value >= 1000) return `${formatDecimal(value / 1000)} L`
  return `${formatDecimal(value)} ${unit}`
}
function formatDecimal(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
}
function dayDifference(date: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000)
}
function relativeDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function OverviewPage({ demo = false, householdId }: { demo?: boolean; householdId?: string }) {
  const expiryAlertDays = readAppPreferences().expiryAlertDays
  const [data, setData] = useState<DashboardData>(() => demo ? createDemoDashboard(expiryAlertDays) : emptyDashboard)
  const [loading, setLoading] = useState(!demo)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    if (!supabase || !householdId) return
    setLoading(true); setError('')
    const monthStart = new Date()
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const [productsResult, lotsResult, purchasesResult, listsResult, movementsResult] = await Promise.all([
      supabase.from('products').select('id, name, category_id, base_unit, minimum_stock, target_stock, purchase_unit_label, base_quantity_per_purchase_unit').eq('household_id', householdId).eq('is_active', true),
      supabase.from('stock_lots').select('product_id, remaining_quantity, expires_on').eq('household_id', householdId).gt('remaining_quantity', 0),
      supabase.from('purchases').select('total').eq('household_id', householdId).eq('status', 'confirmed').gte('purchased_at', monthStart.toISOString()),
      supabase.from('shopping_lists').select('id, name').eq('household_id', householdId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('stock_movements').select('id, product_id, movement_type, quantity_delta, unit, note, created_at').eq('household_id', householdId).order('created_at', { ascending: false }).limit(4),
    ])
    const firstError = productsResult.error ?? lotsResult.error ?? purchasesResult.error ?? listsResult.error ?? movementsResult.error
    if (firstError) { setError(firstError.message); setLoading(false); return }

    const products = (productsResult.data ?? []) as DashboardProduct[]
    const lots = (lotsResult.data ?? []) as DashboardLot[]
    const productMap = new Map(products.map(product => [product.id, product]))
    const stockByProduct = new Map<string, number>()
    for (const lot of lots) stockByProduct.set(lot.product_id, (stockByProduct.get(lot.product_id) ?? 0) + Number(lot.remaining_quantity))

    const lowStock = products.filter(product => Number(product.minimum_stock) > 0 && (stockByProduct.get(product.id) ?? 0) <= Number(product.minimum_stock))
    const categoriesResult = await supabase.from('categories').select('id, name')
    if (categoriesResult.error) { setError(categoriesResult.error.message); setLoading(false); return }
    const categoryRows = (categoriesResult.data ?? []) as Array<{ id: string; name: string }>
    const categoryNames = new Map<string, string>(categoryRows.map(category => [category.id, category.name]))

    let listItems: DashboardData['listItems'] = []
    let pendingCount = 0
    const activeList = listsResult.data as { id: string; name: string } | null
    if (activeList) {
      const { data: items, error: itemsError } = await supabase.from('shopping_list_items').select('id, product_id, custom_name, requested_quantity, unit, is_checked').eq('household_id', householdId).eq('list_id', activeList.id).eq('is_checked', false).order('created_at', { ascending: true })
      if (itemsError) { setError(itemsError.message); setLoading(false); return }
      const pendingItems = (items ?? []) as DashboardItem[]
      pendingCount = pendingItems.length
      listItems = pendingItems.slice(0, 3).map(item => {
        const product = item.product_id ? productMap.get(item.product_id) : null
        return { id: item.id, name: product?.name ?? item.custom_name ?? 'Produto', quantity: formatQuantity(Number(item.requested_quantity), item.unit) }
      })
    }

    const movementRows = (movementsResult.data ?? []) as DashboardMovement[]
    const recent: RecentItem[] = movementRows.map(movement => {
      const product = productMap.get(movement.product_id)
      const movementMeta = movement.movement_type === 'entry'
        ? { title: 'Entrada registrada', tone: 'green', icon: ShoppingBasket }
        : movement.movement_type === 'loss'
          ? { title: 'Perda registrada', tone: 'sand', icon: AlertTriangle }
          : movement.movement_type === 'adjustment'
            ? { title: 'Ajuste de estoque', tone: 'blue', icon: Package }
            : { title: 'Consumo registrado', tone: 'sand', icon: Package }
      return {
        id: movement.id,
        title: movementMeta.title,
        detail: `${product?.name ?? 'Produto'} · ${formatQuantity(Math.abs(Number(movement.quantity_delta)), movement.unit)}${movement.note ? ` · ${movement.note}` : ''}`,
        time: relativeDate(movement.created_at),
        tone: movementMeta.tone,
        icon: movementMeta.icon,
      }
    })

    const expiringCount = lots.filter(lot => lot.expires_on && dayDifference(lot.expires_on) >= 0 && dayDifference(lot.expires_on) <= expiryAlertDays).length
    const purchaseRows = (purchasesResult.data ?? []) as Array<{ total: number | string | null }>
    const monthlySpend = purchaseRows.reduce((sum, purchase) => sum + Number(purchase.total ?? 0), 0)
    setData({
      productCount: products.length,
      lowStockCount: lowStock.length,
      expiringCount,
      monthlySpend,
      lowStock: lowStock.slice(0, 4).map(product => ({
        id: product.id,
        name: product.name,
        category: product.category_id ? categoryNames.get(product.category_id) ?? 'Sem categoria' : 'Sem categoria',
        quantity: formatQuantity(stockByProduct.get(product.id) ?? 0, product.base_unit),
      })),
      listName: activeList?.name ?? null,
      pendingCount,
      listItems,
      recent,
    })
    setLoading(false)
  }, [householdId, expiryAlertDays])

  useEffect(() => {
    if (demo) { setData(createDemoDashboard(expiryAlertDays)); setLoading(false) }
    else void loadDashboard()
  }, [demo, expiryAlertDays, loadDashboard])

  const localNow = new Date()
  const todayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Fortaleza' }).format(localNow)
  const hour = Number(new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', hourCycle: 'h23', timeZone: 'America/Fortaleza' }).format(localNow))
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return <div className="dashboard-page">
    <div className="page-heading-row"><div><div className="eyebrow">{todayLabel}</div><h1>{greeting} <span>🌿</span></h1><p>Veja como está sua cozinha hoje.</p></div><Link to="/despensa" className="button button-primary"><Plus size={17}/> Adicionar produto</Link></div>
    {demo && <div className="demo-callout"><Sparkles size={17}/><span><strong>Você está vendo uma prévia.</strong> Os dados iniciais são exemplos locais. Compras registradas nesta prévia atualizam estoque, lista, preços e indicadores neste navegador.</span></div>}
    {error && <div className="form-alert error dashboard-alert">Não foi possível atualizar o resumo: {error}</div>}
    <section className="metric-grid">
      <article className="metric-card"><div className="metric-top"><span>Produtos cadastrados</span><span className="metric-icon icon-green"><Package size={18}/></span></div><div className="metric-value">{loading ? '—' : data.productCount} <small>itens</small></div><div className="metric-foot">Produtos ativos na residência</div></article>
      <article className="metric-card"><div className="metric-top"><span>Precisam de reposição</span><span className="metric-icon icon-amber"><ShoppingBasket size={18}/></span></div><div className="metric-value">{loading ? '—' : data.lowStockCount} <small>produtos</small></div><div className="metric-foot"><span className="metric-attention"><CircleAlert size={14}/> Estoque baixo</span></div></article>
      <article className="metric-card"><div className="metric-top"><span>Próximos do vencimento</span><span className="metric-icon icon-rose"><CalendarDays size={18}/></span></div><div className="metric-value">{loading ? '—' : data.expiringCount} <small>lotes</small></div><div className="metric-foot"><span className="metric-neutral"><Clock3 size={14}/> Próximos {expiryAlertDays} dias</span></div></article>
      <article className="metric-card"><div className="metric-top"><span>Gastos neste mês</span><span className="metric-icon icon-blue"><TrendingDown size={18}/></span></div><div className="metric-value dashboard-money">{loading ? '—' : formatCurrency(data.monthlySpend)}</div><div className="metric-foot">Compras confirmadas neste mês</div></article>
    </section>

    <section className="dashboard-main-grid">
      <div className="panel stock-panel"><div className="panel-heading"><div><h2>Precisam de atenção</h2><p>Produtos no estoque mínimo ou abaixo dele</p></div><Link to="/despensa" className="text-link">Ver despensa <ArrowRight size={15}/></Link></div>
        <div className="stock-list">{loading ? <div className="dashboard-empty"><LoaderCircle size={17} className="spin"/> Carregando estoque...</div> : data.lowStock.length ? data.lowStock.map(item => <div className="stock-row" key={item.id}><div className="product-avatar warning">{item.name.slice(0, 1).toUpperCase()}</div><div className="stock-product"><strong>{item.name}</strong><span>{item.category}</span></div><div className="stock-quantity"><strong>{item.quantity}</strong><span>em estoque</span></div><span className="status-pill warning">Baixo</span></div>) : <div className="dashboard-empty">Nenhum produto precisa de reposição no momento.</div>}</div>
        <Link to="/compras" className="panel-bottom-link">Gerar lista de compras <ArrowRight size={15}/></Link>
      </div>
      <div className="panel list-panel"><div className="panel-heading"><div><h2>Sua próxima compra</h2><p>{data.listName ?? 'Nenhuma lista ativa'}</p></div><span className="list-basket-icon"><ShoppingBasket size={19}/></span></div>
        <div className="mini-list">{loading ? <div className="dashboard-empty">Carregando lista...</div> : data.listItems.length ? data.listItems.map(item => <div className="mini-list-item" key={item.id}><span className="fake-checkbox"/><span>{item.name}</span><small>{item.quantity}</small></div>) : <div className="dashboard-empty">{data.listName ? 'Nenhum item pendente.' : 'Crie uma lista para planejar sua próxima compra.'}</div>}</div>
        <div className="list-estimate"><span>Itens pendentes</span><strong>{loading ? '—' : data.pendingCount}</strong></div><Link to="/compras" className="button button-outline full-button">Abrir lista de compras <ArrowRight size={15}/></Link>
      </div>
    </section>

    <section className="panel activity-panel"><div className="panel-heading"><div><h2>Atividade recente</h2><p>Movimentações de estoque registradas pelos moradores</p></div><span className="subtle-button">Últimos registros <Check size={14}/></span></div>
      <div className="activity-list">{loading ? <div className="dashboard-empty">Carregando atividade...</div> : data.recent.length ? data.recent.map(item => <div className="activity-row" key={item.id}><div className={`activity-icon ${item.tone}`}><item.icon size={17}/></div><div className="activity-copy"><strong>{item.title}</strong><span>{item.detail}</span></div><time>{item.time}</time></div>) : <div className="dashboard-empty">As movimentações da despensa aparecerão aqui.</div>}</div>
    </section>
    <div className="dashboard-tip"><div className="tip-icon"><Sparkles size={18}/></div><div><strong>Dica para evitar desperdício</strong><p>Registre as datas de validade quando guardar suas compras. Assim, a despensa pode avisar quais produtos devem ser consumidos primeiro.</p></div><Link to="/despensa" aria-label="Ir para despensa"><ArrowRight size={18}/></Link></div>
  </div>
}
