import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, BarChart3, Plus, TrendingUp, Store } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { addDemoPrice, readDemoData } from '../lib/demoData'
import type { BaseUnit, DemoProduct } from '../lib/demoData'

type Product = Pick<DemoProduct, 'id' | 'name' | 'base_unit' | 'purchase_unit_label' | 'base_quantity_per_purchase_unit'>
type PriceRow = { id: string; product_id: string; store_id: string | null; unit_price: number; unit: BaseUnit; observed_at: string; source: string; store_name: string; product_name: string; package_price: number }
type Props = { householdId?: string; demo?: boolean }
const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

export function PriceHistoryPage({ householdId, demo = false }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [rows, setRows] = useState<PriceRow[]>([])
  const [filterProduct, setFilterProduct] = useState('')
  const [productId, setProductId] = useState('')
  const [storeName, setStoreName] = useState('')
  const [packagePrice, setPackagePrice] = useState('')
  const [observedAt, setObservedAt] = useState(today)
  const [stores, setStores] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    if (demo) {
      const data = readDemoData()
      const productsForPage = data.products.filter(product => product.is_active)
      const mapped = data.prices.map(price => {
        const product = productsForPage.find(row => row.id === price.product_id)
        return { ...price, store_id: null, product_name: product?.name ?? 'Produto removido', store_name: price.store_name, package_price: price.unit_price * (product?.base_quantity_per_purchase_unit ?? 1) } as PriceRow
      }).sort((a, b) => b.observed_at.localeCompare(a.observed_at))
      setProducts(productsForPage); setRows(mapped); setStores(data.stores)
      setLoading(false); return
    }
    if (!supabase || !householdId) { setError('Conecte o Supabase para consultar preços reais.'); setLoading(false); return }
    const [productResult, storeResult, priceResult] = await Promise.all([
      supabase.from('products').select('id,name,base_unit,purchase_unit_label,base_quantity_per_purchase_unit').eq('household_id', householdId).eq('is_active', true).order('name'),
      supabase.from('stores').select('id,name').eq('household_id', householdId).order('name'),
      supabase.from('price_history').select('id,product_id,store_id,unit_price,unit,observed_at,source').eq('household_id', householdId).order('observed_at', { ascending: false }).limit(500),
    ])
    const issue = productResult.error ?? storeResult.error ?? priceResult.error
    if (issue) { setError(issue.message); setLoading(false); return }
    const loadedProducts = (productResult.data ?? []) as Product[]
    const storeRows = (storeResult.data ?? []) as Array<{ id: string; name: string }>
    const storeMap = new Map(storeRows.map(store => [store.id, store.name]))
    const productMap = new Map(loadedProducts.map(product => [product.id, product]))
    const mapped = ((priceResult.data ?? []) as Array<Omit<PriceRow, 'store_name' | 'product_name' | 'package_price'>>).map(price => {
      const product = productMap.get(price.product_id)
      return { ...price, store_name: price.store_id ? storeMap.get(price.store_id) ?? 'Mercado não identificado' : 'Preço avulso', product_name: product?.name ?? 'Produto removido', package_price: Number(price.unit_price) * (product?.base_quantity_per_purchase_unit ?? 1) }
    })
    setProducts(loadedProducts); setStores(storeRows.map(store => store.name)); setRows(mapped)
    setLoading(false)
  }, [demo, householdId])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => { if (!productId && products.length) setProductId(products[0].id) }, [productId, products])

  const filtered = useMemo(() => rows.filter(row => !filterProduct || row.product_id === filterProduct), [rows, filterProduct])
  const selectedProduct = products.find(product => product.id === (filterProduct || productId))
  const selectedPrices = selectedProduct ? rows.filter(row => row.product_id === selectedProduct.id) : []
  const bestPrice = selectedPrices.length ? Math.min(...selectedPrices.map(row => row.package_price)) : null
  const latestPrice = selectedPrices[0]?.package_price ?? null
  const previousPrice = selectedPrices[1]?.package_price ?? null
  const variation = latestPrice !== null && previousPrice !== null ? latestPrice - previousPrice : null

  async function submitPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const product = products.find(row => row.id === productId)
    const value = Number(packagePrice)
    if (!product || !Number.isFinite(value) || value < 0) { setError('Selecione um produto e informe um preço válido.'); return }
    setSaving(true); setError(''); setNotice('')
    if (demo) {
      addDemoPrice({ productId, storeName: storeName.trim(), packagePrice: value, observedAt })
      setNotice('Preço registrado no histórico local.'); setPackagePrice(''); await loadData(); setSaving(false); return
    }
    if (!supabase || !householdId) { setSaving(false); return }
    let storeId: string | null = null
    if (storeName.trim()) {
      const { data: store, error: storeError } = await supabase.from('stores').upsert({ household_id: householdId, name: storeName.trim() }, { onConflict: 'household_id,name' }).select('id').single()
      if (storeError) { setError(storeError.message); setSaving(false); return }
      storeId = store.id
    }
    const { error: insertError } = await supabase.from('price_history').insert({
      household_id: householdId, product_id: product.id, store_id: storeId,
      unit_price: value / product.base_quantity_per_purchase_unit,
      unit: product.base_unit, observed_at: new Date(`${observedAt}T12:00:00`).toISOString(), source: 'manual',
    })
    if (insertError) setError(insertError.message)
    else { setNotice('Preço registrado com sucesso.'); setPackagePrice(''); await loadData() }
    setSaving(false)
  }

  return <div className="module-page">
    <div className="page-heading-row module-heading"><div><span className="eyebrow">INTELIGÊNCIA DE PREÇOS</span><h1>Histórico de preços <span>📈</span></h1><p>Acompanhe o preço que sua casa realmente paga e compare os estabelecimentos.</p></div><span className="module-tag"><TrendingUp size={14}/> Dados das suas compras</span></div>
    {demo && <div className="demo-callout"><BarChart3 size={17}/><span><strong>Prévia interativa.</strong> Os preços das compras demonstrativas e os registros manuais ficam neste navegador, sem consulta externa de supermercados.</span></div>}
    {error && <div className="form-alert error commerce-alert">{error}</div>}{notice && <div className="form-alert success commerce-alert">{notice}</div>}
    <section className="price-overview-grid"><article className="metric-card"><div className="metric-top"><span>Menor preço registrado</span><ArrowDownRight size={17}/></div><div className="metric-value commerce-money">{bestPrice === null ? '—' : currency(bestPrice)}</div><div className="metric-foot">{filterProduct ? selectedProduct?.purchase_unit_label : 'Produto selecionado'}</div></article><article className="metric-card"><div className="metric-top"><span>Último preço</span><Store size={17}/></div><div className="metric-value commerce-money">{latestPrice === null ? '—' : currency(latestPrice)}</div><div className="metric-foot">{selectedPrices[0]?.store_name ?? 'Sem registros'}</div></article><article className="metric-card"><div className="metric-top"><span>Variação vs. registro anterior</span>{variation !== null && (variation <= 0 ? <ArrowDownRight size={17}/> : <ArrowUpRight size={17}/>)}</div><div className={`metric-value commerce-money ${variation !== null ? variation <= 0 ? 'price-good' : 'price-high' : ''}`}>{variation === null ? '—' : `${variation > 0 ? '+' : ''}${currency(variation)}`}</div><div className="metric-foot">Comparação com o registro anterior</div></article></section>
    <div className="price-layout"><section className="panel price-history-panel"><div className="panel-heading"><div><h2>Registros de preço</h2><p>Valores normalizados para a embalagem cadastrada.</p></div><select className="text-input compact-select" value={filterProduct} onChange={event => setFilterProduct(event.target.value)}><option value="">Todos os produtos</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
        {loading ? <div className="commerce-empty">Carregando histórico...</div> : filtered.length ? <div className="commerce-table-wrap"><table className="commerce-table"><thead><tr><th>Produto</th><th>Mercado</th><th>Data</th><th>Preço/embalagem</th><th>Origem</th></tr></thead><tbody>{filtered.map(row => <tr key={row.id}><td><strong>{row.product_name}</strong></td><td>{row.store_name}</td><td>{new Intl.DateTimeFormat('pt-BR').format(new Date(row.observed_at))}</td><td><strong>{currency(row.package_price)}</strong></td><td><span className="status-pill neutral">{row.source === 'purchase' ? 'Compra' : row.source === 'external' ? 'Externo' : 'Manual'}</span></td></tr>)}</tbody></table></div> : <div className="commerce-empty"><BarChart3 size={23}/><strong>Ainda não existem preços registrados.</strong><span>Registre uma compra ou adicione um preço manual para começar seu histórico.</span></div>}
      </section>
      <aside className="panel price-add-panel"><div className="panel-heading"><div><h2>Registrar preço</h2><p>Inclua um valor visto no mercado.</p></div><Plus size={18}/></div><form className="commerce-form" onSubmit={submitPrice}><label>Produto<select className="text-input" value={productId} onChange={event => setProductId(event.target.value)} required><option value="">Selecione...</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Mercado (opcional)<input className="text-input" list="price-stores" value={storeName} onChange={event => setStoreName(event.target.value)} placeholder="Ex.: Assaí"/><datalist id="price-stores">{stores.map(store => <option value={store} key={store}/>)}</datalist></label><label>Preço da embalagem (R$)<input className="text-input" type="number" min="0" step="0.01" value={packagePrice} onChange={event => setPackagePrice(event.target.value)} placeholder="Ex.: 6,99" required/></label><label>Data observada<input className="text-input" type="date" value={observedAt} onChange={event => setObservedAt(event.target.value)} required/></label><button className="button button-primary full-button" disabled={saving || loading || products.length === 0}>{saving ? 'Salvando...' : 'Salvar preço'}</button></form><div className="settings-note"><BarChart3 size={15}/><span>Preços de notas confirmadas são registrados automaticamente. Comparação externa entre mercados será adicionada quando houver fonte de dados confiável.</span></div></aside></div>
  </div>
}
