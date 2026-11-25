export type BaseUnit = 'g' | 'ml' | 'un'

export type DemoCategory = { id: string; name: string; icon_key: string }

export const DEMO_CATEGORIES: DemoCategory[] = [
  { id: 'demo-category-grains', name: 'Grãos e cereais', icon_key: 'wheat' },
  { id: 'demo-category-grocery', name: 'Mercearia', icon_key: 'shopping-basket' },
  { id: 'demo-category-produce', name: 'Hortifruti', icon_key: 'carrot' },
  { id: 'demo-category-meat', name: 'Carnes e ovos', icon_key: 'beef' },
  { id: 'demo-category-dairy', name: 'Laticínios', icon_key: 'milk' },
  { id: 'demo-category-drinks', name: 'Bebidas', icon_key: 'cup-soda' },
  { id: 'demo-category-frozen', name: 'Congelados', icon_key: 'snowflake' },
  { id: 'demo-category-bakery', name: 'Padaria', icon_key: 'croissant' },
  { id: 'demo-category-seasoning', name: 'Temperos', icon_key: 'sprout' },
  { id: 'demo-category-cleaning', name: 'Limpeza', icon_key: 'sparkles' },
  { id: 'demo-category-hygiene', name: 'Higiene', icon_key: 'soap-dispenser' },
  { id: 'demo-category-other', name: 'Outros', icon_key: 'package' },
]

export type DemoProduct = {
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
  current_stock: number
  next_expiry: string | null
  category_name: string
}

export type DemoListItem = {
  id: string
  product_id: string | null
  custom_name: string | null
  requested_quantity: number
  unit: BaseUnit
  estimated_unit_price: number | null
  is_checked: boolean
  source: 'manual' | 'low_stock' | 'expiry' | 'suggestion'
  created_at: string
}

export type DemoPurchaseItem = {
  product_id: string
  product_name: string
  quantity: number
  unit: BaseUnit
  unit_price: number
  total_price: number
}

export type DemoPurchase = {
  id: string
  store_name: string
  purchased_at: string
  subtotal: number
  discount: number
  total: number
  status: 'confirmed'
  items: DemoPurchaseItem[]
}

export type DemoPrice = {
  id: string
  product_id: string
  store_name: string
  unit_price: number // preço por unidade-base
  unit: BaseUnit
  observed_at: string
  source: 'purchase' | 'manual'
}

export type DemoData = {
  products: DemoProduct[]
  list: { id: string; name: string; budget: number | null; items: DemoListItem[] }
  purchases: DemoPurchase[]
  prices: DemoPrice[]
  stores: string[]
}

const STORAGE_KEY = 'despensa-inteligente.demo-data.v1'

function seedData(): DemoData {
  const future = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
  }
  const products: DemoProduct[] = [
    { id: 'demo-1', household_id: 'demo-house', category_id: null, name: 'Arroz tipo 1', brand: 'Tio João', barcode: null, base_unit: 'g', purchase_unit_label: 'pacote de 1 kg', base_quantity_per_purchase_unit: 1000, minimum_stock: 1000, target_stock: 3000, storage_location: 'Armário', notes: null, is_active: true, created_at: new Date().toISOString(), current_stock: 500, next_expiry: future(5), category_name: 'Grãos e cereais' },
    { id: 'demo-2', household_id: 'demo-house', category_id: null, name: 'Feijão carioca', brand: 'Kicaldo', barcode: null, base_unit: 'g', purchase_unit_label: 'pacote de 1 kg', base_quantity_per_purchase_unit: 1000, minimum_stock: 1000, target_stock: 3000, storage_location: 'Armário', notes: null, is_active: true, created_at: new Date().toISOString(), current_stock: 2000, next_expiry: '2027-03-20', category_name: 'Grãos e cereais' },
    { id: 'demo-3', household_id: 'demo-house', category_id: null, name: 'Leite integral', brand: null, barcode: null, base_unit: 'ml', purchase_unit_label: 'caixa de 1 L', base_quantity_per_purchase_unit: 1000, minimum_stock: 1000, target_stock: 3000, storage_location: 'Armário', notes: null, is_active: true, created_at: new Date().toISOString(), current_stock: 1000, next_expiry: future(3), category_name: 'Laticínios' },
    { id: 'demo-4', household_id: 'demo-house', category_id: null, name: 'Óleo de soja', brand: null, barcode: null, base_unit: 'ml', purchase_unit_label: 'garrafa de 900 ml', base_quantity_per_purchase_unit: 900, minimum_stock: 900, target_stock: 1800, storage_location: 'Armário', notes: null, is_active: true, created_at: new Date().toISOString(), current_stock: 0, next_expiry: null, category_name: 'Mercearia' },
    { id: 'demo-5', household_id: 'demo-house', category_id: null, name: 'Café torrado', brand: null, barcode: null, base_unit: 'g', purchase_unit_label: 'pacote de 500 g', base_quantity_per_purchase_unit: 500, minimum_stock: 500, target_stock: 1500, storage_location: 'Armário', notes: null, is_active: true, created_at: new Date().toISOString(), current_stock: 750, next_expiry: '2027-02-18', category_name: 'Bebidas' },
    { id: 'demo-6', household_id: 'demo-house', category_id: null, name: 'Detergente', brand: null, barcode: null, base_unit: 'un', purchase_unit_label: 'frasco', base_quantity_per_purchase_unit: 1, minimum_stock: 2, target_stock: 4, storage_location: 'Área de serviço', notes: null, is_active: true, created_at: new Date().toISOString(), current_stock: 3, next_expiry: null, category_name: 'Limpeza' },
  ]
  const past = (monthsAgo: number) => {
    const date = new Date()
    date.setMonth(date.getMonth() - monthsAgo)
    date.setDate(8)
    return date.toISOString()
  }
  const purchases: DemoPurchase[] = [
    { id: 'demo-purchase-1', store_name: 'Atacadão', purchased_at: past(2), subtotal: 54, discount: 0, total: 54, status: 'confirmed', items: [
      { product_id: 'demo-1', product_name: 'Arroz tipo 1', quantity: 2000, unit: 'g', unit_price: .0065, total_price: 13 },
      { product_id: 'demo-2', product_name: 'Feijão carioca', quantity: 3000, unit: 'g', unit_price: .007, total_price: 21 },
      { product_id: 'demo-3', product_name: 'Leite integral', quantity: 4000, unit: 'ml', unit_price: .005, total_price: 20 },
    ] },
    { id: 'demo-purchase-2', store_name: 'Assaí', purchased_at: past(1), subtotal: 48.76, discount: 0, total: 48.76, status: 'confirmed', items: [
      { product_id: 'demo-4', product_name: 'Óleo de soja', quantity: 1800, unit: 'ml', unit_price: .0082, total_price: 14.76 },
      { product_id: 'demo-5', product_name: 'Café torrado', quantity: 1000, unit: 'g', unit_price: .034, total_price: 34 },
    ] },
    { id: 'demo-purchase-3', store_name: 'Supermercado Central', purchased_at: new Date().toISOString(), subtotal: 17.2, discount: 0, total: 17.2, status: 'confirmed', items: [
      { product_id: 'demo-1', product_name: 'Arroz tipo 1', quantity: 1000, unit: 'g', unit_price: .0068, total_price: 6.8 },
      { product_id: 'demo-3', product_name: 'Leite integral', quantity: 2000, unit: 'ml', unit_price: .0052, total_price: 10.4 },
    ] },
  ]
  const prices: DemoPrice[] = [
    { id: 'demo-price-1', product_id: 'demo-1', store_name: 'Atacadão', unit_price: .0065, unit: 'g', observed_at: past(2), source: 'purchase' },
    { id: 'demo-price-2', product_id: 'demo-1', store_name: 'Assaí', unit_price: .0069, unit: 'g', observed_at: past(1), source: 'purchase' },
    { id: 'demo-price-3', product_id: 'demo-1', store_name: 'Supermercado Central', unit_price: .0068, unit: 'g', observed_at: new Date().toISOString(), source: 'purchase' },
    { id: 'demo-price-4', product_id: 'demo-3', store_name: 'Assaí', unit_price: .005, unit: 'ml', observed_at: past(1), source: 'purchase' },
  ]
  const data: DemoData = {
    products,
    list: { id: 'demo-list-1', name: 'Compras da casa', budget: 350, items: [] },
    purchases,
    prices,
    stores: ['Atacadão', 'Assaí', 'Supermercado Central'],
  }
  return syncDemoLowStock(data)
}

export function syncDemoLowStock(data: DemoData): DemoData {
  const list = data.list
  for (const product of data.products.filter(item => item.is_active)) {
    const low = product.minimum_stock > 0 && product.current_stock <= product.minimum_stock
    const existing = list.items.find(item => item.product_id === product.id)
    if (low) {
      const needed = Math.max(product.target_stock - product.current_stock, product.base_quantity_per_purchase_unit)
      if (existing) {
        if (existing.source === 'low_stock' && !existing.is_checked) existing.requested_quantity = needed
      } else {
        list.items.push({ id: `demo-item-${crypto.randomUUID()}`, product_id: product.id, custom_name: null, requested_quantity: needed, unit: product.base_unit, estimated_unit_price: null, is_checked: false, source: 'low_stock', created_at: new Date().toISOString() })
      }
    } else if (existing?.source === 'low_stock' && !existing.is_checked) {
      list.items = list.items.filter(item => item.id !== existing.id)
    }
  }
  return data
}

export function readDemoData(): DemoData {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as DemoData
      if (parsed.products && parsed.list && parsed.purchases && parsed.prices) return parsed
    }
  } catch {
    // Recria os dados ilustrativos se o armazenamento local estiver indisponível ou inválido.
  }
  const data = seedData()
  writeDemoData(data)
  return data
}

export function writeDemoData(data: DemoData): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function createDemoProduct(input: {
  name: string
  categoryId: string | null
  brand: string | null
  barcode: string | null
  baseUnit: BaseUnit
  purchaseUnitLabel: string
  conversion: number
  minimumStock: number
  targetStock: number
  storageLocation: string | null
  notes: string | null
  initialPurchaseUnits: number
  initialUnitCost: number | null
  initialExpiresOn: string | null
}): DemoData {
  const data = readDemoData()
  const normalizedName = input.name.trim().toLocaleLowerCase('pt-BR')
  if (data.products.some(product => product.name.trim().toLocaleLowerCase('pt-BR') === normalizedName)) {
    throw new Error('Já existe um produto com esse nome na sua despensa de demonstração.')
  }

  const category = DEMO_CATEGORIES.find(item => item.id === input.categoryId)
  const now = new Date().toISOString()
  const product: DemoProduct = {
    id: `demo-product-${crypto.randomUUID()}`,
    household_id: 'demo-house',
    category_id: category?.id ?? null,
    name: input.name.trim(),
    brand: input.brand,
    barcode: input.barcode,
    base_unit: input.baseUnit,
    purchase_unit_label: input.purchaseUnitLabel.trim(),
    base_quantity_per_purchase_unit: input.conversion,
    minimum_stock: input.minimumStock,
    target_stock: input.targetStock,
    storage_location: input.storageLocation,
    notes: input.notes,
    is_active: true,
    created_at: now,
    current_stock: input.initialPurchaseUnits * input.conversion,
    next_expiry: input.initialPurchaseUnits > 0 ? input.initialExpiresOn : null,
    category_name: category?.name ?? 'Sem categoria',
  }
  data.products.unshift(product)

  if (input.initialPurchaseUnits > 0 && input.initialUnitCost !== null) {
    data.prices.unshift({
      id: `demo-price-${crypto.randomUUID()}`,
      product_id: product.id,
      store_name: 'Cadastro inicial',
      unit_price: input.initialUnitCost / input.conversion,
      unit: input.baseUnit,
      observed_at: now,
      source: 'manual',
    })
  }

  syncDemoLowStock(data)
  if (!writeDemoData(data)) {
    throw new Error('O navegador não conseguiu salvar os dados localmente. Verifique se o armazenamento do site está permitido e tente novamente.')
  }
  return data
}

export function saveDemoListItem(input: { productId?: string; customName?: string; quantity: number; unit?: BaseUnit }) {
  const data = readDemoData()
  const product = input.productId ? data.products.find(item => item.id === input.productId) : undefined
  const existing = product ? data.list.items.find(item => item.product_id === product.id) : undefined
  const baseQuantity = input.quantity * (product?.base_quantity_per_purchase_unit ?? 1)
  if (existing) {
    existing.requested_quantity = baseQuantity
    existing.is_checked = false
    existing.source = 'manual'
  } else {
    data.list.items.push({
      id: `demo-item-${crypto.randomUUID()}`,
      product_id: product?.id ?? null,
      custom_name: input.customName?.trim() || null,
      requested_quantity: baseQuantity,
      unit: product?.base_unit ?? input.unit ?? 'un',
      estimated_unit_price: null,
      is_checked: false,
      source: 'manual',
      created_at: new Date().toISOString(),
    })
  }
  writeDemoData(data)
  return data
}

export function updateDemoListItem(itemId: string, patch: Partial<Pick<DemoListItem, 'requested_quantity' | 'estimated_unit_price' | 'is_checked'>>) {
  const data = readDemoData()
  const item = data.list.items.find(row => row.id === itemId)
  if (item) Object.assign(item, patch)
  writeDemoData(data)
  return data
}

export function removeDemoListItem(itemId: string) {
  const data = readDemoData()
  data.list.items = data.list.items.filter(item => item.id !== itemId)
  writeDemoData(data)
  return data
}

export function updateDemoBudget(budget: number | null) {
  const data = readDemoData()
  data.list.budget = budget
  writeDemoData(data)
  return data
}

export function completeDemoPurchase(input: {
  storeName: string
  purchasedAt: string
  discount: number
  notes?: string
  listId?: string
  items: Array<{ productId: string; quantity: number; unitPrice: number; expiresOn?: string }>
}) {
  const data = readDemoData()
  const purchaseItems: DemoPurchaseItem[] = []
  let subtotal = 0
  for (const row of input.items) {
    const product = data.products.find(item => item.id === row.productId)
    if (!product) continue
    const baseQuantity = row.quantity * product.base_quantity_per_purchase_unit
    const lineTotal = Number((row.quantity * row.unitPrice).toFixed(2))
    subtotal += lineTotal
    product.current_stock += baseQuantity
    if (row.expiresOn && (!product.next_expiry || row.expiresOn < product.next_expiry)) product.next_expiry = row.expiresOn
    purchaseItems.push({ product_id: product.id, product_name: product.name, quantity: baseQuantity, unit: product.base_unit, unit_price: row.unitPrice / product.base_quantity_per_purchase_unit, total_price: lineTotal })
    data.prices.unshift({ id: `demo-price-${crypto.randomUUID()}`, product_id: product.id, store_name: input.storeName || 'Compra sem mercado', unit_price: row.unitPrice / product.base_quantity_per_purchase_unit, unit: product.base_unit, observed_at: new Date(input.purchasedAt).toISOString(), source: 'purchase' })
  }
  const total = Math.max(0, Number((subtotal - input.discount).toFixed(2)))
  const purchase: DemoPurchase = { id: `demo-purchase-${crypto.randomUUID()}`, store_name: input.storeName || 'Compra sem mercado', purchased_at: new Date(input.purchasedAt).toISOString(), subtotal: Number(subtotal.toFixed(2)), discount: input.discount, total, status: 'confirmed', items: purchaseItems }
  data.purchases.unshift(purchase)
  if (input.storeName && !data.stores.includes(input.storeName)) data.stores.push(input.storeName)
  for (const row of input.items) {
    const listItem = data.list.items.find(item => item.product_id === row.productId)
    const product = data.products.find(item => item.id === row.productId)
    if (!listItem || !product) continue
    if (listItem.source === 'low_stock' && product.current_stock > product.minimum_stock) {
      data.list.items = data.list.items.filter(item => item.id !== listItem.id)
    } else {
      listItem.is_checked = true
    }
  }
  syncDemoLowStock(data)
  writeDemoData(data)
  return data
}

export function addDemoPrice(input: { productId: string; storeName: string; packagePrice: number; observedAt: string }) {
  const data = readDemoData()
  const product = data.products.find(item => item.id === input.productId)
  if (product) data.prices.unshift({ id: `demo-price-${crypto.randomUUID()}`, product_id: product.id, store_name: input.storeName || 'Preço avulso', unit_price: input.packagePrice / product.base_quantity_per_purchase_unit, unit: product.base_unit, observed_at: new Date(input.observedAt).toISOString(), source: 'manual' })
  if (input.storeName && !data.stores.includes(input.storeName)) data.stores.push(input.storeName)
  writeDemoData(data)
  return data
}

export function saveDemoReceiptMetadata(input: { fileName: string; mimeType: string; purchaseId?: string }) {
  // O modo demonstração não envia arquivos ao servidor; mantém somente um registro local descritivo.
  const data = readDemoData()
  try {
    const receiptNotes = window.localStorage.getItem(`${STORAGE_KEY}.receipts`)
    const records = receiptNotes ? JSON.parse(receiptNotes) as Array<Record<string, string>> : []
    records.unshift({ fileName: input.fileName, mimeType: input.mimeType, createdAt: new Date().toISOString(), purchaseId: input.purchaseId ?? '' })
    window.localStorage.setItem(`${STORAGE_KEY}.receipts`, JSON.stringify(records.slice(0, 30)))
  } catch {
    // A compra demonstrativa já foi registrada; a falha em guardar metadados do anexo não deve desfazê-la.
  }
  return data
}
