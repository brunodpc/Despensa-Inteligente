import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle, Archive, CalendarDays, CirclePlus, Clock3,
  Edit3, Filter, LoaderCircle, Package, Plus, Search, ShoppingBasket, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { readAppPreferences } from '../lib/appPreferences'
import { createDemoProduct, DEMO_CATEGORIES, readDemoData } from '../lib/demoData'

type BaseUnit = 'g' | 'ml' | 'un'
type Category = { id: string; name: string; icon_key: string }
type Product = {
  id: string
  household_id: string
  category_id: string | null
  name: string
  brand: string | null
  barcode: string | null
  base_unit: BaseUnit
  purchase_unit_label: string
  base_quantity_per_purchase_unit: number
  minimum_stock: number
  target_stock: number
  storage_location: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}
type Lot = {
  id: string
  product_id: string
  remaining_quantity: number
  unit: BaseUnit
  expires_on: string | null
}
type PantryProduct = Product & {
  current_stock: number
  next_expiry: string | null
  category_name: string
}
type ProductForm = {
  name: string
  category_id: string
  brand: string
  barcode: string
  base_unit: BaseUnit
  purchase_unit_label: string
  conversion: string
  minimum_purchase_units: string
  target_purchase_units: string
  storage_location: string
  notes: string
  initial_purchase_units: string
  initial_unit_cost: string
  initial_expires_on: string
}

type Props = { householdId?: string; demo?: boolean }

const emptyForm: ProductForm = {
  name: '', category_id: '', brand: '', barcode: '', base_unit: 'un',
  purchase_unit_label: 'unidade', conversion: '1', minimum_purchase_units: '1',
  target_purchase_units: '3', storage_location: 'Despensa', notes: '',
  initial_purchase_units: '0', initial_unit_cost: '', initial_expires_on: '',
}

function createEmptyForm(): ProductForm {
  const preferredUnit = readAppPreferences().defaultBaseUnit
  if (preferredUnit === 'g') return { ...emptyForm, base_unit: 'g', purchase_unit_label: 'pacote de 1 kg', conversion: '1000' }
  if (preferredUnit === 'ml') return { ...emptyForm, base_unit: 'ml', purchase_unit_label: 'embalagem de 1 L', conversion: '1000' }
  return { ...emptyForm }
}

const unitPresets = [
  { id: 'un', label: 'Unidade (un)', baseUnit: 'un' as BaseUnit, purchaseUnitLabel: 'unidade', conversion: '1' },
  { id: 'kg', label: 'Pacote de 1 kg (1.000 g)', baseUnit: 'g' as BaseUnit, purchaseUnitLabel: 'pacote de 1 kg', conversion: '1000' },
  { id: 'g500', label: 'Pacote de 500 g', baseUnit: 'g' as BaseUnit, purchaseUnitLabel: 'pacote de 500 g', conversion: '500' },
  { id: 'l', label: 'Embalagem de 1 L (1.000 ml)', baseUnit: 'ml' as BaseUnit, purchaseUnitLabel: 'embalagem de 1 L', conversion: '1000' },
  { id: 'ml500', label: 'Garrafa de 500 ml', baseUnit: 'ml' as BaseUnit, purchaseUnitLabel: 'garrafa de 500 ml', conversion: '500' },
]

function presetValue(form: ProductForm) {
  return unitPresets.find(preset =>
    preset.baseUnit === form.base_unit &&
    preset.purchaseUnitLabel === form.purchase_unit_label &&
    preset.conversion === form.conversion,
  )?.id ?? 'custom'
}

function applyUnitPreset(form: ProductForm, id: string): ProductForm {
  if (id === 'custom') return form
  const preset = unitPresets.find(item => item.id === id)
  if (!preset) return form
  return { ...form, base_unit: preset.baseUnit, purchase_unit_label: preset.purchaseUnitLabel, conversion: preset.conversion }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
}
function formatBase(value: number, unit: BaseUnit) {
  if (unit === 'g' && value >= 1000) return `${formatNumber(value / 1000)} kg`
  if (unit === 'ml' && value >= 1000) return `${formatNumber(value / 1000)} L`
  return `${formatNumber(value)} ${unit}`
}
function pluralizePurchaseUnit(label: string) {
  const rules: Array<[RegExp, string]> = [
    [/^pacote\b/i, 'pacotes'], [/^unidade\b/i, 'unidades'], [/^caixa\b/i, 'caixas'],
    [/^garrafa\b/i, 'garrafas'], [/^lata\b/i, 'latas'], [/^saco\b/i, 'sacos'],
    [/^fardo\b/i, 'fardos'], [/^bandeja\b/i, 'bandejas'], [/^rolo\b/i, 'rolos'],
    [/^frasco\b/i, 'frascos'], [/^pote\b/i, 'potes'],
  ]
  for (const [pattern, plural] of rules) if (pattern.test(label)) return label.replace(pattern, plural)
  return label
}
function formatPurchaseUnits(value: number, product: Product) {
  const amount = value / Number(product.base_quantity_per_purchase_unit)
  const unit = product.purchase_unit_label || 'unidade'
  return `${formatNumber(amount)} ${amount === 1 ? unit : pluralizePurchaseUnit(unit)}`
}
function daysUntil(date: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${date}T00:00:00`)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}
function formatDate(date: string | null) {
  if (!date) return 'Sem validade informada'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${date}T00:00:00`))
}
export function PantryPage({ householdId, demo = false }: Props) {
  const [products, setProducts] = useState<PantryProduct[]>(demo ? readDemoData().products : [])
  const [categories, setCategories] = useState<Category[]>(demo ? DEMO_CATEGORIES : [])
  const [loading, setLoading] = useState(!demo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'expiry'>('all')
  const [showProductForm, setShowProductForm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [editing, setEditing] = useState<PantryProduct | null>(null)
  const [form, setForm] = useState<ProductForm>(createEmptyForm)
  const [stockAction, setStockAction] = useState<{ kind: 'entry' | 'consume'; product: PantryProduct } | null>(null)
  const [stockQuantity, setStockQuantity] = useState('1')
  const [stockExpiry, setStockExpiry] = useState('')
  const [stockCost, setStockCost] = useState('')
  const [stockNote, setStockNote] = useState('')

  const loadData = useCallback(async () => {
    if (!supabase || !householdId) return
    setLoading(true)
    setError('')
    const [productResult, categoryResult, lotResult] = await Promise.all([
      supabase.from('products').select('id, household_id, category_id, name, brand, barcode, base_unit, purchase_unit_label, base_quantity_per_purchase_unit, minimum_stock, target_stock, storage_location, notes, is_active, created_at').eq('household_id', householdId).eq('is_active', true).order('name'),
      supabase.from('categories').select('id, name, icon_key').order('sort_order'),
      supabase.from('stock_lots').select('id, product_id, remaining_quantity, unit, expires_on').eq('household_id', householdId).gt('remaining_quantity', 0),
    ])
    const queryError = productResult.error ?? categoryResult.error ?? lotResult.error
    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }
    const productRows = (productResult.data ?? []) as Product[]
    const categoryRows = (categoryResult.data ?? []) as Category[]
    const lotRows = (lotResult.data ?? []) as Lot[]
    const categoryById = new Map(categoryRows.map(category => [category.id, category.name]))
    const lotsByProduct = new Map<string, Lot[]>()
    for (const lot of lotRows) {
      const list = lotsByProduct.get(lot.product_id) ?? []
      list.push(lot)
      lotsByProduct.set(lot.product_id, list)
    }
    setCategories(categoryRows)
    setProducts(productRows.map(product => {
      const lots = lotsByProduct.get(product.id) ?? []
      const expiries = lots.map(lot => lot.expires_on).filter((value): value is string => Boolean(value)).sort()
      return {
        ...product,
        current_stock: lots.reduce((sum, lot) => sum + Number(lot.remaining_quantity), 0),
        next_expiry: expiries[0] ?? null,
        category_name: product.category_id ? categoryById.get(product.category_id) ?? 'Sem categoria' : 'Sem categoria',
      }
    }))
    setLoading(false)
  }, [householdId])

  useEffect(() => { if (!demo) void loadData() }, [demo, loadData])

  const isLowStock = (product: PantryProduct) => Number(product.minimum_stock) > 0 && product.current_stock <= Number(product.minimum_stock)
  const lowStockCount = products.filter(isLowStock).length
  const expiryAlertDays = readAppPreferences().expiryAlertDays
  const expiringCount = products.filter(product => product.next_expiry && daysUntil(product.next_expiry) >= 0 && daysUntil(product.next_expiry) <= expiryAlertDays).length
  const filteredProducts = useMemo(() => products.filter(product => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    const matchesSearch = !query || [product.name, product.brand ?? '', product.category_name].some(value => value.toLocaleLowerCase('pt-BR').includes(query))
    const matchesFilter = filter === 'all' || (filter === 'low' && isLowStock(product)) || (filter === 'expiry' && Boolean(product.next_expiry && daysUntil(product.next_expiry) >= 0 && daysUntil(product.next_expiry) <= expiryAlertDays))
    return matchesSearch && matchesFilter
  }), [products, search, filter, expiryAlertDays])

  function startCreate() {
    setEditing(null); setForm(createEmptyForm()); setError(''); setNotice(''); setShowDetails(false); setShowProductForm(true)
  }
  function startEdit(product: PantryProduct) {
    const nextForm: ProductForm = {
      ...emptyForm,
      name: product.name,
      category_id: product.category_id ?? '',
      brand: product.brand ?? '',
      barcode: product.barcode ?? '',
      base_unit: product.base_unit,
      purchase_unit_label: product.purchase_unit_label,
      conversion: String(product.base_quantity_per_purchase_unit),
      minimum_purchase_units: String(Number(product.minimum_stock) / product.base_quantity_per_purchase_unit),
      target_purchase_units: String(Number(product.target_stock) / product.base_quantity_per_purchase_unit),
      storage_location: product.storage_location ?? '',
      notes: product.notes ?? '',
    }
    setEditing(product)
    setForm(nextForm)
    setError(''); setNotice(''); setShowDetails(presetValue(nextForm) === 'custom'); setShowProductForm(true)
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setError(''); setNotice('')
    const conversion = Number(form.conversion)
    const minimum = Number(form.minimum_purchase_units)
    const target = Number(form.target_purchase_units)
    const initial = Number(form.initial_purchase_units || 0)
    const initialCost = form.initial_unit_cost.trim() === '' ? null : Number(form.initial_unit_cost)
    if (!form.name.trim() || !form.purchase_unit_label.trim() || !Number.isFinite(conversion) || conversion <= 0 || !Number.isFinite(minimum) || minimum < 0 || !Number.isFinite(target) || target < minimum || !Number.isFinite(initial) || initial < 0 || (initialCost !== null && (!Number.isFinite(initialCost) || initialCost < 0))) {
      setError('Confira os campos obrigatórios, a conversão, o custo e as quantidades. O estoque desejado deve ser maior ou igual ao mínimo.')
      setSaving(false); return
    }

    if (demo) {
      try {
        const data = createDemoProduct({
          name: form.name,
          categoryId: form.category_id || null,
          brand: form.brand.trim() || null,
          barcode: form.barcode.trim() || null,
          baseUnit: form.base_unit,
          purchaseUnitLabel: form.purchase_unit_label,
          conversion,
          minimumStock: minimum * conversion,
          targetStock: target * conversion,
          storageLocation: form.storage_location.trim() || null,
          notes: form.notes.trim() || null,
          initialPurchaseUnits: initial,
          initialUnitCost: initialCost,
          initialExpiresOn: form.initial_expires_on || null,
        })
        setProducts(data.products.filter(product => product.is_active))
        setCategories(DEMO_CATEGORIES)
        setNotice(`${form.name.trim()} foi cadastrado nesta prévia local.`)
        setShowProductForm(false)
        setForm(createEmptyForm())
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o produto nesta prévia.')
      }
      setSaving(false)
      return
    }

    if (!supabase || !householdId) {
      setError('Não foi possível identificar a residência. Configure o Supabase, entre na sua conta e selecione uma residência antes de cadastrar produtos.')
      setSaving(false)
      return
    }

    if (editing) {
      const { error: updateError } = await supabase.from('products').update({
        name: form.name.trim(), category_id: form.category_id || null,
        brand: form.brand.trim() || null, barcode: form.barcode.trim() || null,
        purchase_unit_label: form.purchase_unit_label.trim(),
        base_quantity_per_purchase_unit: conversion,
        minimum_stock: minimum * conversion, target_stock: target * conversion,
        storage_location: form.storage_location.trim() || null, notes: form.notes.trim() || null,
      }).eq('id', editing.id).eq('household_id', householdId)
      if (updateError) setError(updateError.message)
      else { setNotice('Produto atualizado.'); setShowProductForm(false); await loadData() }
    } else {
      const { error: insertError } = await supabase.rpc('create_product_with_stock', {
        p_household_id: householdId,
        p_name: form.name.trim(),
        p_category_id: form.category_id || null,
        p_brand: form.brand.trim() || null,
        p_barcode: form.barcode.trim() || null,
        p_base_unit: form.base_unit,
        p_purchase_unit_label: form.purchase_unit_label.trim(),
        p_base_quantity_per_purchase_unit: conversion,
        p_minimum_stock: minimum * conversion,
        p_target_stock: target * conversion,
        p_storage_location: form.storage_location.trim() || null,
        p_notes: form.notes.trim() || null,
        p_initial_quantity: initial * conversion,
        p_initial_unit_cost: form.initial_unit_cost.trim() ? Number(form.initial_unit_cost) / conversion : null,
        p_initial_expires_on: form.initial_expires_on || null,
      })
      if (insertError) setError(insertError.message)
      else { setNotice('Produto cadastrado e estoque inicial registrado.'); setShowProductForm(false); await loadData() }
    }
    setSaving(false)
  }

  function openStockAction(kind: 'entry' | 'consume', product: PantryProduct) {
    setStockAction({ kind, product })
    setStockQuantity('1'); setStockExpiry(''); setStockCost(''); setStockNote(''); setError(''); setNotice('')
  }

  async function submitStockAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !householdId || !stockAction) return
    const qty = Number(stockQuantity)
    if (!Number.isFinite(qty) || qty <= 0) { setError('Informe uma quantidade maior que zero.'); return }
    setSaving(true); setError(''); setNotice('')
    const product = stockAction.product
    if (stockAction.kind === 'entry') {
      const { error: entryError } = await supabase.rpc('add_stock_lot', {
        p_household_id: householdId,
        p_product_id: product.id,
        p_quantity: qty * Number(product.base_quantity_per_purchase_unit),
        p_unit: product.base_unit,
        p_unit_cost: stockCost.trim() ? Number(stockCost) / Number(product.base_quantity_per_purchase_unit) : null,
        p_expires_on: stockExpiry || null,
        p_storage_location: product.storage_location,
        p_source: 'manual',
        p_movement_type: 'entry',
      })
      if (entryError) setError(entryError.message)
      else { setNotice('Entrada registrada no estoque.'); setStockAction(null); await loadData() }
    } else {
      const { error: consumeError } = await supabase.rpc('remove_stock', {
        p_household_id: householdId,
        p_product_id: product.id,
        p_quantity: qty * Number(product.base_quantity_per_purchase_unit),
        p_movement_type: 'consumption',
        p_note: stockNote.trim() || 'Consumo registrado pela despensa',
      })
      if (consumeError) setError(consumeError.message)
      else { setNotice('Consumo registrado. O sistema baixou primeiro os lotes com vencimento mais próximo.'); setStockAction(null); await loadData() }
    }
    setSaving(false)
  }

  async function archiveProduct(product: PantryProduct) {
    if (!supabase || !window.confirm(`Arquivar ${product.name}? O histórico de estoque será preservado.`)) return
    setSaving(true); setError(''); setNotice('')
    const { error: archiveError } = await supabase.from('products').update({ is_active: false }).eq('id', product.id).eq('household_id', householdId)
    if (archiveError) setError(archiveError.message)
    else { setNotice(`${product.name} foi arquivado.`); await loadData() }
    setSaving(false)
  }

  const showForm = showProductForm || Boolean(stockAction)
  return (
    <div className="pantry-page">
      <div className="page-heading-row pantry-heading">
        <div><span className="eyebrow">ESTOQUE COMPARTILHADO</span><h1>Minha despensa</h1><p>Cadastre produtos, acompanhe quantidades e registre cada movimentação.</p></div>
        <button className="button button-primary" onClick={startCreate}><Plus size={16}/> Adicionar produto</button>
      </div>

      {demo && <div className="demo-callout"><AlertTriangle size={17}/><span><strong>Prévia local interativa.</strong> Você pode cadastrar produtos e o sistema salva os registros neste navegador. Esses dados não são sincronizados com outros dispositivos; para compartilhar a despensa entre moradores, conecte o Supabase.</span></div>}
      {error && !showForm && <div className="form-alert error pantry-alert">{error}</div>}
      {notice && !showForm && <div className="form-alert success pantry-alert">{notice}</div>}

      <section className="pantry-metrics">
        <article className="metric-card"><div className="metric-top"><span>Produtos ativos</span><span className="metric-icon icon-green"><Package size={18}/></span></div><div className="metric-value">{products.length}<small> produtos</small></div><div className="metric-foot">Itens cadastrados na residência</div></article>
        <article className="metric-card"><div className="metric-top"><span>Precisam de reposição</span><span className="metric-icon icon-amber"><ShoppingBasket size={18}/></span></div><div className="metric-value">{lowStockCount}<small> produtos</small></div><div className="metric-foot"><span className="metric-attention"><AlertTriangle size={13}/> Estoque no mínimo ou abaixo</span></div></article>
        <article className="metric-card"><div className="metric-top"><span>Vencem em {expiryAlertDays} dias</span><span className="metric-icon icon-rose"><CalendarDays size={18}/></span></div><div className="metric-value">{expiringCount}<small> lotes</small></div><div className="metric-foot">Consulte as datas de validade</div></article>
      </section>

      <section className="panel pantry-toolbar">
        <div className="pantry-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar produto, marca ou categoria" aria-label="Buscar produtos"/></div>
        <div className="pantry-filters" role="group" aria-label="Filtrar produtos">
          <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}><Filter size={14}/> Todos</button>
          <button className={filter === 'low' ? 'selected' : ''} onClick={() => setFilter('low')}><AlertTriangle size={14}/> Estoque baixo</button>
          <button className={filter === 'expiry' ? 'selected' : ''} onClick={() => setFilter('expiry')}><Clock3 size={14}/> Vencimento</button>
        </div>
      </section>

      <section className="panel pantry-table-panel">
        <div className="panel-heading"><div><h2>Produtos da residência</h2><p>Quantidade consolidada a partir dos lotes ativos.</p></div><span className="pantry-result-count">{filteredProducts.length} {filteredProducts.length === 1 ? 'produto' : 'produtos'}</span></div>
        {loading ? <div className="pantry-empty"><LoaderCircle className="spin" size={21}/> Carregando despensa...</div> : filteredProducts.length === 0 ? <div className="pantry-empty"><Package size={26}/><strong>{products.length ? 'Nenhum produto encontrado' : 'Sua despensa ainda está vazia'}</strong><span>{products.length ? 'Tente alterar a busca ou o filtro.' : 'Cadastre o primeiro produto para começar a controlar o estoque.'}</span>{!products.length && <button className="button button-primary" onClick={startCreate}><Plus size={15}/> Cadastrar primeiro produto</button>}</div> : (
          <div className="pantry-product-list">
            {filteredProducts.map(product => {
              const low = isLowStock(product)
              const expiryDays = product.next_expiry ? daysUntil(product.next_expiry) : null
              const expiryWarning = expiryDays !== null && expiryDays >= 0 && expiryDays <= expiryAlertDays
              return <article className="pantry-product-row" key={product.id}>
                <div className={`product-avatar ${product.current_stock === 0 ? 'critical' : low ? 'warning' : 'icon-green'}`}>{product.name.slice(0, 1).toUpperCase()}</div>
                <div className="pantry-product-main"><strong>{product.name}</strong><span>{product.category_name}{product.brand ? ` · ${product.brand}` : ''}{product.storage_location ? ` · ${product.storage_location}` : ''}</span><small>Mínimo: {formatPurchaseUnits(Number(product.minimum_stock), product)} · Desejado: {formatPurchaseUnits(Number(product.target_stock), product)}</small></div>
                <div className="pantry-stock-value"><strong>{formatPurchaseUnits(product.current_stock, product)}</strong><span>{formatBase(product.current_stock, product.base_unit)}</span></div>
                <div className="pantry-expiry"><span className={expiryWarning ? 'expiry-warning' : ''}>{expiryWarning && <AlertTriangle size={12}/>} {product.next_expiry ? `Validade: ${formatDate(product.next_expiry)}` : 'Validade não informada'}</span><small>{product.next_expiry && expiryDays !== null ? expiryDays < 0 ? 'Lote vencido' : expiryDays === 0 ? 'Vence hoje' : `Em ${expiryDays} dias` : ' '}</small></div>
                <div className="pantry-actions"><button title="Registrar entrada" aria-label={`Registrar entrada de ${product.name}`} onClick={() => openStockAction('entry', product)} disabled={demo}><CirclePlus size={16}/></button><button title="Registrar consumo" aria-label={`Registrar consumo de ${product.name}`} onClick={() => openStockAction('consume', product)} disabled={demo}><ShoppingBasket size={16}/></button><button title="Editar produto" aria-label={`Editar ${product.name}`} onClick={() => startEdit(product)} disabled={demo}><Edit3 size={16}/></button><button title="Arquivar produto" aria-label={`Arquivar ${product.name}`} onClick={() => void archiveProduct(product)} disabled={demo}><Archive size={16}/></button></div>
              </article>
            })}
          </div>
        )}
      </section>

      {showForm && <div className="pantry-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) { setShowProductForm(false); setStockAction(null) } }}>
        <section className="pantry-modal" role="dialog" aria-modal="true" aria-labelledby="pantry-modal-title">
          <div className="pantry-modal-heading"><div><span className="eyebrow">{stockAction ? stockAction.kind === 'entry' ? 'REPOSIÇÃO' : 'CONSUMO' : editing ? 'CATÁLOGO DA CASA' : 'NOVO CADASTRO'}</span><h2 id="pantry-modal-title">{stockAction ? `${stockAction.kind === 'entry' ? 'Registrar entrada' : 'Registrar consumo'} · ${stockAction.product.name}` : editing ? 'Editar produto' : 'Adicionar produto'}</h2></div><button className="icon-button" onClick={() => { setShowProductForm(false); setStockAction(null) }} disabled={saving} aria-label="Fechar"><X size={19}/></button></div>
          {stockAction ? <form className="pantry-form" onSubmit={submitStockAction}>
            <div className="pantry-form-note">{stockAction.kind === 'entry' ? `Informe quantos ${stockAction.product.purchase_unit_label}(s) foram adicionados. A quantidade será convertida para ${stockAction.product.base_unit}.` : `A quantidade será descontada do estoque. O sistema prioriza os lotes com vencimento mais próximo.`}</div>
            <label>Quantidade ({stockAction.product.purchase_unit_label})<input className="text-input" type="number" min="0.001" step="0.001" value={stockQuantity} onChange={event => setStockQuantity(event.target.value)} required/></label>
            {stockAction.kind === 'entry' ? <><label>Validade do lote (opcional)<input className="text-input" type="date" value={stockExpiry} onChange={event => setStockExpiry(event.target.value)}/></label><label>Custo por {stockAction.product.purchase_unit_label} em R$ (opcional)<input className="text-input" type="number" min="0" step="0.01" value={stockCost} onChange={event => setStockCost(event.target.value)} placeholder="Ex.: 7,90"/></label></> : <label>Observação (opcional)<input className="text-input" value={stockNote} onChange={event => setStockNote(event.target.value)} placeholder="Ex.: preparo do jantar"/></label>}
            <div className="pantry-form-preview">Quantidade movimentada: <strong>{formatBase(Number(stockQuantity || 0) * Number(stockAction.product.base_quantity_per_purchase_unit), stockAction.product.base_unit)}</strong></div>
            {error && <div className="form-alert error">{error}</div>}
            <div className="pantry-form-actions"><button type="button" className="button button-outline" onClick={() => setStockAction(null)} disabled={saving}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Salvando...' : stockAction.kind === 'entry' ? 'Confirmar entrada' : 'Confirmar consumo'}</button></div>
          </form> : <form className="pantry-form" onSubmit={submitProduct}>
            <div className="pantry-form-grid">
              <label className="span-2">Nome do produto<input className="text-input" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength={120} placeholder="Ex.: Arroz tipo 1" required/></label>
              <label className="span-2">Como você compra?
                <select className="text-input" disabled={Boolean(editing)} value={presetValue(form)} onChange={event => { const value = event.target.value; setForm(current => applyUnitPreset(current, value)); if (value === 'custom') setShowDetails(true) }}>
                  {unitPresets.map(preset => <option value={preset.id} key={preset.id}>{preset.label}</option>)}
                  <option value="custom">Outra embalagem (personalizar)</option>
                </select>
                <small>A conversão para grama, ml ou unidade é preenchida automaticamente.</small>
              </label>
              <label>Avisar quando chegar a (embalagens)<input className="text-input" type="number" min="0" step="0.01" value={form.minimum_purchase_units} onChange={event => setForm({ ...form, minimum_purchase_units: event.target.value })} required/></label>
              <label>Quantidade ideal (embalagens)<input className="text-input" type="number" min="0" step="0.01" value={form.target_purchase_units} onChange={event => setForm({ ...form, target_purchase_units: event.target.value })} required/></label>
              {!editing && <label className="span-2">Já tenho em casa (opcional)<input className="text-input" type="number" min="0" step="0.01" value={form.initial_purchase_units} onChange={event => setForm({ ...form, initial_purchase_units: event.target.value })} placeholder="0"/></label>}
              <details className="pantry-advanced span-2" open={showDetails} onToggle={event => setShowDetails(event.currentTarget.open)}>
                <summary>Mais opções (opcional)</summary>
                <div className="pantry-form-grid pantry-advanced-grid">
                  <label>Unidade-base<select className="text-input" disabled={Boolean(editing)} value={form.base_unit} onChange={event => setForm({ ...form, base_unit: event.target.value as BaseUnit, conversion: event.target.value === 'un' ? '1' : '1000' })}><option value="g">Gramas (g)</option><option value="ml">Mililitros (ml)</option><option value="un">Unidades (un)</option></select></label>
                  <label>Como você compra?<input className="text-input" value={form.purchase_unit_label} onChange={event => setForm({ ...form, purchase_unit_label: event.target.value })} maxLength={60} placeholder="pacote de 1 kg" required/></label>
                  <label>Conversão para unidade-base<input className="text-input" type="number" min="0.001" step="0.001" value={form.conversion} onChange={event => setForm({ ...form, conversion: event.target.value })} required/><small>Ex.: 1 pacote de 1 kg = 1.000 g</small></label>
                  <label>Categoria<select className="text-input" value={form.category_id} onChange={event => setForm({ ...form, category_id: event.target.value })}><option value="">Sem categoria</option>{categories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
                  <label>Marca (opcional)<input className="text-input" value={form.brand} onChange={event => setForm({ ...form, brand: event.target.value })} placeholder="Ex.: Tio João"/></label>
                  <label>Localização<input className="text-input" value={form.storage_location} onChange={event => setForm({ ...form, storage_location: event.target.value })} placeholder="Armário, geladeira..."/></label>
                  <label>Código de barras (opcional)<input className="text-input" value={form.barcode} onChange={event => setForm({ ...form, barcode: event.target.value })} placeholder="EAN/GTIN"/></label>
                  {!editing && <>
                    <label>Custo por embalagem em R$ (opcional)<input className="text-input" type="number" min="0" step="0.01" value={form.initial_unit_cost} onChange={event => setForm({ ...form, initial_unit_cost: event.target.value })} placeholder="Ex.: 6,50"/></label>
                    <label>Validade do estoque inicial<input className="text-input" type="date" value={form.initial_expires_on} onChange={event => setForm({ ...form, initial_expires_on: event.target.value })}/></label>
                  </>}
                  <label className="span-2">Observações<textarea className="text-input pantry-textarea" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Informações adicionais sobre o produto"/></label>
                </div>
              </details>
            </div>
            {error && <div className="form-alert error">{error}</div>}
            <div className="pantry-form-actions"><button type="button" className="button button-outline" onClick={() => setShowProductForm(false)} disabled={saving}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar produto'}</button></div>
          </form>}
        </section>
      </div>}

      {loading && !demo && <div className="pantry-loading-footnote"><LoaderCircle size={14} className="spin" /> Sincronizando com a residência...</div>}
      {showForm && <div className="sr-only" aria-live="polite">Formulário aberto</div>}
    </div>
  )
}
