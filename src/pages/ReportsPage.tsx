import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, CalendarDays, Package, RefreshCw, ShoppingBag, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { readDemoData } from '../lib/demoData'

type Props = { householdId?: string; demo?: boolean }
type Purchase = { id: string; purchased_at: string; total: number }
type PurchaseItem = { purchase_id: string; product_id: string | null; product_name_snapshot: string; quantity: number; unit: string; total_price: number }
type Product = { id: string; name: string; category_id: string | null }
type LossTotals = { g: number; ml: number; un: number }
type ReportData = { purchases: Purchase[]; items: PurchaseItem[]; products: Product[]; categories: Array<{ id: string; name: string }>; losses: LossTotals }
const emptyLosses: LossTotals = { g: 0, ml: 0, un: 0 }
const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

function monthKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key: string) { const [year, month] = key.split('-').map(Number); return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(year, month - 1, 1)).replace('.', '') }
function buildMonths(count: number) {
  const result: string[] = []
  const now = new Date()
  now.setDate(1)
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    result.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

export function ReportsPage({ householdId, demo = false }: Props) {
  const [data, setData] = useState<ReportData>({ purchases: [], items: [], products: [], categories: [], losses: emptyLosses })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    const start = new Date()
    start.setMonth(start.getMonth() - 5, 1)
    start.setHours(0, 0, 0, 0)
    if (demo) {
      const demoData = readDemoData()
      const purchases = demoData.purchases.map(item => ({ id: item.id, purchased_at: item.purchased_at, total: item.total }))
      const items: PurchaseItem[] = demoData.purchases.flatMap(purchase => purchase.items.map(item => ({ purchase_id: purchase.id, product_id: item.product_id, product_name_snapshot: item.product_name, quantity: item.quantity, unit: item.unit, total_price: item.total_price })))
      const productRows = demoData.products.map(item => ({ id: item.id, name: item.name, category_id: item.category_name }))
      setData({ purchases, items, products: productRows, categories: [...new Set(demoData.products.map(product => product.category_name))].map(name => ({ id: name, name })), losses: { ...emptyLosses } })
      setLoading(false); return
    }
    if (!supabase || !householdId) { setError('Conecte o Supabase para consultar relatórios reais.'); setLoading(false); return }
    const [purchaseResult, productResult, categoryResult, lossResult] = await Promise.all([
      supabase.from('purchases').select('id,purchased_at,total').eq('household_id', householdId).eq('status', 'confirmed').gte('purchased_at', start.toISOString()).order('purchased_at'),
      supabase.from('products').select('id,name,category_id').eq('household_id', householdId),
      supabase.from('categories').select('id,name').order('sort_order'),
      supabase.from('stock_movements').select('quantity_delta,unit').eq('household_id', householdId).eq('movement_type', 'loss').gte('created_at', start.toISOString()),
    ])
    const issue = purchaseResult.error ?? productResult.error ?? categoryResult.error ?? lossResult.error
    if (issue) { setError(issue.message); setLoading(false); return }
    const purchases = (purchaseResult.data ?? []) as Purchase[]
    let items: PurchaseItem[] = []
    if (purchases.length) {
      const { data: itemRows, error: itemError } = await supabase.from('purchase_items').select('purchase_id,product_id,product_name_snapshot,quantity,unit,total_price').eq('household_id', householdId).in('purchase_id', purchases.map(purchase => purchase.id))
      if (itemError) { setError(itemError.message); setLoading(false); return }
      items = (itemRows ?? []) as PurchaseItem[]
    }
    const losses = (lossResult.data ?? []).reduce<LossTotals>((totals, row) => {
      const unit = row.unit as keyof LossTotals
      if (unit in totals) totals[unit] += Math.abs(Number(row.quantity_delta))
      return totals
    }, { ...emptyLosses })
    setData({ purchases, items, products: (productResult.data ?? []) as Product[], categories: (categoryResult.data ?? []) as Array<{ id: string; name: string }>, losses })
    setLoading(false)
  }, [demo, householdId])

  useEffect(() => { void loadData() }, [loadData])

  const months = buildMonths(6)
  const monthly = useMemo(() => months.map(key => ({ key, label: monthLabel(key), value: data.purchases.filter(purchase => monthKey(purchase.purchased_at) === key).reduce((sum, purchase) => sum + Number(purchase.total), 0) })), [data.purchases, months.join('|')])
  const maxMonthly = Math.max(1, ...monthly.map(item => item.value))
  const currentMonth = monthKey(new Date())
  const monthSpend = monthly.find(item => item.key === currentMonth)?.value ?? 0
  const totalSixMonths = data.purchases.reduce((sum, purchase) => sum + Number(purchase.total), 0)
  const averageTicket = data.purchases.length ? totalSixMonths / data.purchases.length : 0
  const productMap = new Map(data.products.map(product => [product.id, product]))
  const categoryMap = new Map(data.categories.map(category => [category.id, category.name]))
  const categorySpend = useMemo(() => {
    const totals = new Map<string, number>()
    for (const item of data.items) {
      const product = item.product_id ? productMap.get(item.product_id) : null
      const name = product?.category_id ? categoryMap.get(product.category_id) ?? 'Sem categoria' : 'Sem categoria'
      totals.set(name, (totals.get(name) ?? 0) + Number(item.total_price))
    }
    return [...totals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [data.items, data.products, data.categories])
  const topProducts = useMemo(() => {
    const totals = new Map<string, { name: string; spend: number; quantity: number; unit: string }>()
    for (const item of data.items) {
      const product = item.product_id ? productMap.get(item.product_id) : null
      const key = item.product_id ?? item.product_name_snapshot
      const existing = totals.get(key) ?? { name: product?.name ?? item.product_name_snapshot, spend: 0, quantity: 0, unit: item.unit }
      existing.spend += Number(item.total_price); existing.quantity += Number(item.quantity); totals.set(key, existing)
    }
    return [...totals.values()].sort((a, b) => b.spend - a.spend).slice(0, 5)
  }, [data.items, data.products])
  const categoryMax = Math.max(1, ...categorySpend.map(item => item.value))

  return <div className="module-page">
    <div className="page-heading-row module-heading"><div><span className="eyebrow">VISÃO DA CASA</span><h1>Relatórios <span>📊</span></h1><p>Entenda gastos, categorias e comportamento de consumo da residência.</p></div><button className="button button-outline" onClick={() => void loadData()} disabled={loading}><RefreshCw size={14}/> Atualizar dados</button></div>
    {demo && <div className="demo-callout"><BarChart3 size={17}/><span><strong>Relatório demonstrativo.</strong> Os dados iniciais são exemplos locais. Compras que você registrar nesta prévia passam a compor os indicadores.</span></div>}
    {error && <div className="form-alert error commerce-alert">{error}</div>}
    <div className="reports-period-label"><CalendarDays size={14}/> Últimos seis meses · {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(startOfSixMonthPeriod())} até hoje</div>
    <section className="reports-metrics"><article className="metric-card"><div className="metric-top"><span>Gasto neste mês</span><ShoppingBag size={17}/></div><div className="metric-value commerce-money">{loading ? '—' : currency(monthSpend)}</div><div className="metric-foot">Compras confirmadas no mês atual</div></article><article className="metric-card"><div className="metric-top"><span>Total em seis meses</span><TrendingUp size={17}/></div><div className="metric-value commerce-money">{loading ? '—' : currency(totalSixMonths)}</div><div className="metric-foot">{data.purchases.length} compras registradas</div></article><article className="metric-card"><div className="metric-top"><span>Ticket médio</span><Activity size={17}/></div><div className="metric-value commerce-money">{loading ? '—' : currency(averageTicket)}</div><div className="metric-foot">Valor médio por compra</div></article><article className="metric-card"><div className="metric-top"><span>Perdas registradas</span><Package size={17}/></div><div className="metric-value report-loss-value">{loading ? '—' : ([['g', data.losses.g], ['ml', data.losses.ml], ['un', data.losses.un]] as const).filter(([, value]) => value > 0).map(([unit, value]) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unit}`).join(' · ') || '0'}</div><div className="metric-foot">Unidades separadas, sem somar medidas incompatíveis</div></article></section>
    <div className="reports-grid"><section className="panel reports-chart-panel"><div className="panel-heading"><div><h2>Evolução dos gastos</h2><p>Valor total das compras por mês.</p></div><BarChart3 size={19}/></div>{loading ? <div className="commerce-empty">Calculando...</div> : <div className="monthly-chart">{monthly.map(item => <div className="monthly-bar-column" key={item.key}><strong>{item.value ? currency(item.value) : '—'}</strong><div className="monthly-bar-track"><div style={{ height: `${Math.max(2, item.value / maxMonthly * 100)}%` }}/></div><small>{item.label}</small></div>)}</div>}</section>
      <section className="panel reports-category-panel"><div className="panel-heading"><div><h2>Gastos por categoria</h2><p>Distribuição dos itens comprados.</p></div><Package size={18}/></div>{categorySpend.length ? <div className="category-bars">{categorySpend.map(item => <div className="category-bar-row" key={item.name}><div><strong>{item.name}</strong><span>{currency(item.value)}</span></div><div className="category-bar-track"><div style={{ width: `${item.value / categoryMax * 100}%` }}/></div></div>)}</div> : <div className="commerce-empty">Ainda não há categorias com compras registradas.</div>}</section></div>
    <section className="panel reports-top-products"><div className="panel-heading"><div><h2>Produtos com maior gasto</h2><p>Ordenados pelo total registrado nas compras do período.</p></div><TrendingUp size={19}/></div>{topProducts.length ? <div className="commerce-table-wrap"><table className="commerce-table"><thead><tr><th>Produto</th><th>Quantidade registrada</th><th>Valor total</th></tr></thead><tbody>{topProducts.map(item => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {item.unit}</td><td><strong>{currency(item.spend)}</strong></td></tr>)}</tbody></table></div> : <div className="commerce-empty">As compras registradas aparecerão nesta análise.</div>}</section>
    <p className="reports-footnote">Os relatórios usam somente compras confirmadas e movimentações registradas. As perdas são exibidas separadas por gramas, mililitros e unidades; não representam custo financeiro.</p>
  </div>
}

function startOfSixMonthPeriod() {
  const date = new Date()
  date.setMonth(date.getMonth() - 5, 1)
  date.setHours(0, 0, 0, 0)
  return date
}
