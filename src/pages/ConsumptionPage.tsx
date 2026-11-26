import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, LoaderCircle, Minus, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { readDemoData, syncDemoLowStock, writeDemoData } from '../lib/demoData'

type BaseUnit = 'g' | 'ml' | 'un'
type ConsumableProduct = {
  id: string
  name: string
  brand: string | null
  base_unit: BaseUnit
  purchase_unit_label: string
  conversion: number
  stock: number
}

type Props = { householdId?: string; demo?: boolean }

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
}

export function ConsumptionPage({ householdId, demo = false }: Props) {
  const [products, setProducts] = useState<ConsumableProduct[]>([])
  const [loading, setLoading] = useState(!demo)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    if (demo) {
      const data = readDemoData()
      setProducts(data.products.filter(product => product.is_active).map(product => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        base_unit: product.base_unit,
        purchase_unit_label: product.purchase_unit_label,
        conversion: Number(product.base_quantity_per_purchase_unit),
        stock: Number(product.current_stock),
      })))
      setLoading(false)
      return
    }
    if (!supabase || !householdId) return
    setLoading(true)
    const [productResult, lotResult] = await Promise.all([
      supabase.from('products').select('id, name, brand, base_unit, purchase_unit_label, base_quantity_per_purchase_unit').eq('household_id', householdId).eq('is_active', true).order('name'),
      supabase.from('stock_lots').select('product_id, remaining_quantity').eq('household_id', householdId).gt('remaining_quantity', 0),
    ])
    const queryError = productResult.error ?? lotResult.error
    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }
    const stockByProduct = new Map<string, number>()
    for (const lot of lotResult.data ?? []) {
      stockByProduct.set(lot.product_id, (stockByProduct.get(lot.product_id) ?? 0) + Number(lot.remaining_quantity))
    }
    setProducts((productResult.data ?? []).map(product => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      base_unit: product.base_unit as BaseUnit,
      purchase_unit_label: product.purchase_unit_label,
      conversion: Number(product.base_quantity_per_purchase_unit),
      stock: stockByProduct.get(product.id) ?? 0,
    })))
    setLoading(false)
  }, [demo, householdId])

  useEffect(() => { void loadData() }, [loadData])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    return products.filter(product => !query || `${product.name} ${product.brand ?? ''}`.toLocaleLowerCase('pt-BR').includes(query))
  }, [products, search])

  const selected = products.find(product => product.id === selectedId) ?? null
  const availablePackages = selected ? selected.stock / selected.conversion : 0
  const requested = Number(quantity || 0)
  const previewBase = selected ? requested * selected.conversion : 0

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setSaving(true); setError(''); setNotice('')
    if (!Number.isFinite(requested) || requested <= 0) {
      setError('Informe uma quantidade maior que zero.')
      setSaving(false); return
    }
    if (requested > availablePackages) {
      setError(`Sem estoque suficiente. Disponível: ${formatNumber(availablePackages)} ${selected.purchase_unit_label}(s).`)
      setSaving(false); return
    }
    const baseQuantity = previewBase
    if (demo) {
      const data = readDemoData()
      const product = data.products.find(item => item.id === selected.id)
      if (!product) {
        setError('Produto não encontrado na prévia local.')
        setSaving(false); return
      }
      product.current_stock = Math.max(0, Number(product.current_stock) - baseQuantity)
      syncDemoLowStock(data)
      writeDemoData(data)
    } else {
      if (!supabase || !householdId) {
        setError('Residência não carregada. Recarregue a página e tente novamente.')
        setSaving(false); return
      }
      const { error: rpcError } = await supabase.rpc('remove_stock', {
        p_household_id: householdId,
        p_product_id: selected.id,
        p_quantity: baseQuantity,
        p_movement_type: 'consumption',
        p_note: note.trim() || 'Consumo rápido',
      })
      if (rpcError) {
        setError(rpcError.message)
        setSaving(false); return
      }
    }
    setNotice(`Consumo de ${selected.name} registrado. O sistema baixou primeiro os lotes com vencimento mais próximo.`)
    setQuantity('1'); setNote('')
    await loadData()
    setSaving(false)
  }

  return (
    <div className="consume-page module-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">MOVIMENTAÇÃO RÁPIDA</span>
          <h1>Consumo rápido</h1>
          <p>Escolha o produto usado e baixe do estoque sem precisar abrir a despensa.</p>
        </div>
      </div>
      <section className="panel consume-panel">
        <div className="panel-heading"><div><h2>Qual produto você usou?</h2><p>A baixa respeita a validade dos lotes automaticamente.</p></div><Minus size={20}/></div>
        <label className="consume-search"><Search size={16}/><input className="text-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome ou marca"/></label>
        <div className="consume-product-grid">
          {filtered.map(product => {
            const packages = product.stock / product.conversion
            return (
              <button
                type="button"
                key={product.id}
                className={`consume-product ${selectedId === product.id ? 'selected' : ''}`}
                disabled={packages <= 0}
                onClick={() => { setSelectedId(product.id); setQuantity('1'); setError(''); setNotice('') }}
              >
                <strong>{product.name}</strong>
                <small>{product.brand ? `${product.brand} · ` : ''}{formatNumber(packages)} {product.purchase_unit_label}(s)</small>
              </button>
            )
          })}
          {!loading && filtered.length === 0 && <p className="consume-empty">Nenhum produto encontrado com esse nome.</p>}
        </div>
        {selected && <form className="consume-form" onSubmit={event => void submit(event)}>
          <div className="consume-selected"><Check size={16}/><span><strong>{selected.name}</strong><small>Disponível: {formatNumber(availablePackages)} {selected.purchase_unit_label}(s) · {formatNumber(selected.stock)} {selected.base_unit}</small></span></div>
          <div className="consume-form-grid">
            <label>Quantidade usada ({selected.purchase_unit_label})<input className="text-input" type="number" min="0.001" step="0.001" value={quantity} onChange={event => setQuantity(event.target.value)} required/></label>
            <label>Observação (opcional)<input className="text-input" value={note} onChange={event => setNote(event.target.value)} placeholder="Ex.: jantar de segunda-feira"/></label>
          </div>
          <div className="consume-preview">Será baixado do estoque: <strong>{formatNumber(previewBase)} {selected.base_unit}</strong></div>
          {error && <div className="form-alert error">{error}</div>}
          {notice && <div className="form-alert success">{notice}</div>}
          <div className="pantry-form-actions"><button className="button button-primary" disabled={saving}>{saving ? <LoaderCircle size={15} className="spin"/> : <Minus size={15}/>} {saving ? 'Registrando...' : 'Registrar consumo'}</button></div>
        </form>}
        {!selected && <p className="consume-hint">Selecione um produto acima para informar a quantidade consumida.</p>}
      </section>
    </div>
  )
}
