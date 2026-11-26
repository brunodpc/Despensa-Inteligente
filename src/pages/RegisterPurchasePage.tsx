import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, CheckCircle2, ExternalLink, FileImage, FileText, Plus, Receipt, ScanBarcode, ScanLine, Trash2, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { QrScanner } from '../components/QrScanner'
import { supabase } from '../lib/supabase'
import { notifyShoppingListChanged } from '../lib/events'
import { completeDemoPurchase, readDemoData, saveDemoReceiptMetadata } from '../lib/demoData'
import type { DemoProduct } from '../lib/demoData'
import { normalizeProductName, parseNfceDocument, parseNfceQr } from '../lib/nfce'
import type { NfceParsedItem, NfceQrInfo } from '../lib/nfce'

type Product = Pick<DemoProduct, 'id' | 'name' | 'barcode' | 'base_unit' | 'purchase_unit_label' | 'base_quantity_per_purchase_unit'>
type PurchaseLine = { id: string; productId: string; quantity: string; unitPrice: string; expiresOn: string }
type Props = { householdId?: string; demo?: boolean }
const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const newLine = (productId = ''): PurchaseLine => ({ id: crypto.randomUUID(), productId, quantity: '1', unitPrice: '', expiresOn: '' })

export function RegisterPurchasePage({ householdId, demo = false }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<string[]>([])
  const [listId, setListId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(today)
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<PurchaseLine[]>([newLine()])
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [barcode, setBarcode] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [qrManual, setQrManual] = useState('')
  const [qrInfo, setQrInfo] = useState<NfceQrInfo | null>(null)
  const [xmlText, setXmlText] = useState('')
  const [qrBusy, setQrBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    if (demo) {
      const data = readDemoData()
      setProducts(data.products.filter(p => p.is_active))
      setStores(data.stores)
      setListId(data.list.id)
      setLines(current => current.length === 1 && !current[0].productId ? [newLine(data.products[0]?.id ?? '')] : current)
      setLoading(false); return
    }
    if (!supabase || !householdId) { setLoading(false); setError('Conecte o Supabase para registrar compras.'); return }
    const [productResult, storeResult, listResult] = await Promise.all([
      supabase.from('products').select('id,name,barcode,base_unit,purchase_unit_label,base_quantity_per_purchase_unit').eq('household_id', householdId).eq('is_active', true).order('name'),
      supabase.from('stores').select('name').eq('household_id', householdId).order('name'),
      supabase.from('shopping_lists').select('id').eq('household_id', householdId).eq('status', 'active').maybeSingle(),
    ])
    const issue = productResult.error ?? storeResult.error ?? listResult.error
    if (issue) setError(issue.message)
    const loadedProducts = (productResult.data ?? []) as Product[]
    setProducts(loadedProducts); setStores((storeResult.data ?? []).map(row => row.name)); setListId(listResult.data?.id ?? null)
    setLines(current => current.length === 1 && !current[0].productId ? [newLine(loadedProducts[0]?.id ?? '')] : current)
    setLoading(false)
  }, [demo, householdId])

  useEffect(() => { void loadData() }, [loadData])

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0), [lines])
  const discountValue = Number(discount) || 0
  const total = Math.max(0, subtotal - discountValue)
  const lineError = lines.some(line => !line.productId || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0 || !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0)

  function updateLine(id: string, patch: Partial<PurchaseLine>) {
    setLines(current => current.map(line => line.id === id ? { ...line, ...patch } : line))
  }

  function addScannedBarcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = products.find(product => product.barcode && product.barcode === barcode.trim())
    if (!found) { setError('Código não encontrado no catálogo. Cadastre o produto na despensa ou confira o número lido.'); return }
    setLines(current => {
      const existing = current.find(line => line.productId === found.id)
      if (existing) return current.map(line => line.id === existing.id ? { ...line, quantity: String(Number(line.quantity) + 1) } : line)
      return [...current, newLine(found.id)]
    })
    setBarcode(''); setError('')
    setNotice(`${found.name} adicionado pelo código de barras.`)
  }

  function appendNote(text: string) {
    setNotes(current => [current.trim(), text].filter(Boolean).join('\n').slice(0, 2000))
  }

  function applyParsedItems(items: NfceParsedItem[], source: string) {
    const unmatched: string[] = []
    const parsedLines: PurchaseLine[] = []
    for (const item of items) {
      const normalized = normalizeProductName(item.name)
      const found = products.find(product => {
        const candidate = normalizeProductName(product.name)
        return candidate === normalized || candidate.includes(normalized) || (normalized.length > 5 && normalized.includes(candidate))
      })
      if (!found) { unmatched.push(item.name); continue }
      parsedLines.push({ ...newLine(found.id), quantity: String(item.quantity), unitPrice: item.unitPrice.toFixed(2) })
    }
    if (!parsedLines.length) {
      setError('Nenhum item da nota correspondeu ao catálogo. Cadastre os produtos na despensa e tente novamente.')
      return
    }
    setLines(current => {
      const base = current.length === 1 && !current[0].productId ? [] : current
      const next = [...base]
      for (const parsed of parsedLines) {
        const existing = next.find(line => line.productId === parsed.productId)
        if (existing) {
          next[next.indexOf(existing)] = {
            ...existing,
            quantity: String(Number(existing.quantity || 0) + Number(parsed.quantity)),
            unitPrice: parsed.unitPrice,
          }
        } else next.push(parsed)
      }
      return next.length ? next : [newLine(products[0]?.id ?? '')]
    })
    setError('')
    setNotice(`${parsedLines.length} item(ns) preenchido(s) ${source}. Confira os valores antes de confirmar.`)
    if (unmatched.length) appendNote(`Itens da nota não encontrados no catálogo: ${unmatched.join(', ')}`)
  }

  const handleQrDetect = useCallback((value: string) => {
    const info = parseNfceQr(value)
    setQrInfo(info)
    setQrManual(value)
    setScannerOpen(false)
    setError('')
    if (info.purchasedAt) setPurchasedAt(info.purchasedAt)
    if (info.chave) appendNote(`Chave NFC-e: ${info.chave}`)
    if (info.total) appendNote(`Valor da nota: ${info.total.toFixed(2)}`)
    setNotice(info.isValidNfce
      ? `QR da NFC-e lido${info.uf ? ` (${info.uf})` : ''}. Tente importar os itens ou informe manualmente os que faltarem.`
      : 'QR lido, mas não parece ser uma NFC-e. Você ainda pode usar a chave e informar os itens manualmente.')
  }, [])

  async function importFromQrUrl() {
    if (!qrInfo?.url) { setError('Este QR não contém uma URL de consulta. Use o XML ou informe os itens manualmente.'); return }
    setQrBusy(true); setError('')
    try {
      const response = await fetch(qrInfo.url, { mode: 'cors' })
      if (!response.ok) throw new Error(`Consulta retornou ${response.status}`)
      const items = parseNfceDocument(await response.text())
      if (items.length) applyParsedItems(items, 'pela consulta do QR')
      else setError('A consulta abriu, mas não trouxe os itens em formato legível. Abra a nota no navegador ou cole o XML.')
    } catch {
      setError('A SEFAZ não permitiu a leitura automática neste navegador. Use "Abrir consulta" ou cole o XML da nota.')
    } finally {
      setQrBusy(false)
    }
  }

  function importFromXml() {
    const items = parseNfceDocument(xmlText)
    if (!items.length) { setError('Não encontrei itens no texto colado. Cole o conteúdo completo do XML da NFC-e.'); return }
    applyParsedItems(items, 'do XML')
    setXmlText('')
  }

  async function submitPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(''); setNotice('')
    if (lines.length === 0 || lineError) { setError('Selecione um produto e informe uma quantidade e um preço válidos para cada linha.'); return }
    if (!Number.isFinite(discountValue) || discountValue < 0 || discountValue > subtotal) { setError('O desconto precisa estar entre zero e o subtotal.'); return }
    if (receiptFile && receiptFile.size > 15 * 1024 * 1024) { setError('A nota fiscal deve ter no máximo 15 MB.'); return }
    setSaving(true)

    if (demo) {
      const data = completeDemoPurchase({
        storeName: storeName.trim(), purchasedAt: new Date(`${purchasedAt}T12:00:00`).toISOString(), discount: discountValue,
        notes, listId: listId ?? undefined,
        items: lines.map(line => ({ productId: line.productId, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), expiresOn: line.expiresOn || undefined })),
      })
      if (receiptFile) saveDemoReceiptMetadata({ fileName: receiptFile.name, mimeType: receiptFile.type })
      setProducts(data.products.filter(p => p.is_active)); setStores(data.stores); setNotice(`Compra registrada na prévia local: ${currency(data.purchases[0]?.total ?? total)}. O estoque e o histórico de preços foram atualizados neste navegador.`)
      setLines([newLine(data.products[0]?.id ?? '')]); setDiscount('0'); setNotes(''); setReceiptFile(null); notifyShoppingListChanged(); setSaving(false); return
    }

    if (!supabase || !householdId) { setError('Supabase não está conectado.'); setSaving(false); return }
    let receiptPath: string | null = null
    if (receiptFile) {
      const safeName = receiptFile.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-90)
      receiptPath = `${householdId}/${Date.now()}_${safeName}`
      const { error: uploadError } = await supabase.storage.from('purchase-receipts').upload(receiptPath, receiptFile, { contentType: receiptFile.type, upsert: false })
      if (uploadError) { setError(`Não foi possível anexar a nota: ${uploadError.message}`); setSaving(false); return }
    }
    const requestId = crypto.randomUUID()
    const { data: purchaseId, error: purchaseError } = await supabase.rpc('confirm_household_purchase', {
      p_household_id: householdId,
      p_client_request_id: requestId,
      p_store_name: storeName.trim() || null,
      p_purchased_at: new Date(`${purchasedAt}T12:00:00`).toISOString(),
      p_discount: discountValue,
      p_notes: notes.trim() || null,
      p_items: lines.map(line => ({ product_id: line.productId, quantity: Number(line.quantity), unit_price: Number(line.unitPrice), expires_on: line.expiresOn || null })),
      p_list_id: listId,
      p_receipt_storage_path: receiptPath,
      p_receipt_original_file_name: receiptFile?.name ?? null,
      p_receipt_mime_type: receiptFile?.type ?? null,
    })
    if (purchaseError) {
      if (receiptPath) await supabase.storage.from('purchase-receipts').remove([receiptPath])
      setError(purchaseError.message); setSaving(false); return
    }
    setNotice(`Compra confirmada com sucesso (${String(purchaseId).slice(0, 8)}). O estoque, os movimentos e o histórico de preços foram atualizados.`)
    setLines([newLine(products[0]?.id ?? '')]); setDiscount('0'); setNotes(''); setReceiptFile(null); notifyShoppingListChanged(); await loadData(); setSaving(false)
  }

  return <div className="module-page">
    <div className="page-heading-row module-heading"><div><span className="eyebrow">ENTRADA DE COMPRAS</span><h1>Registrar compra <span>🧾</span></h1><p>Registre os produtos que chegaram, anexe a nota e atualize o estoque em uma única confirmação.</p></div><Link className="button button-outline" to="/precos">Histórico de preços</Link></div>
    {demo && <div className="demo-callout"><Receipt size={17}/><span><strong>Prévia interativa.</strong> A confirmação altera o estoque, as compras e os preços salvos neste navegador. Não há sincronização entre dispositivos.</span></div>}
    {error && <div className="form-alert error commerce-alert"><AlertCircle size={15}/>{error}</div>}{notice && <div className="form-alert success commerce-alert"><CheckCircle2 size={15}/>{notice}</div>}
    <div className="purchase-layout">
      <form className="panel purchase-form-panel" onSubmit={submitPurchase}>
        <div className="panel-heading"><div><h2>Dados da compra</h2><p>Informe o mercado, a data e os produtos do cupom ou da nota fiscal.</p></div><Receipt size={19}/></div>
        <div className="commerce-form purchase-meta-grid"><label>Mercado / estabelecimento<input className="text-input" list="purchase-stores" value={storeName} onChange={event => setStoreName(event.target.value)} placeholder="Ex.: Atacadão"/><datalist id="purchase-stores">{stores.map(store => <option key={store} value={store}/>)}</datalist></label><label>Data da compra<input className="text-input" type="date" value={purchasedAt} onChange={event => setPurchasedAt(event.target.value)} required/></label></div>
        <div className="purchase-lines-heading"><div><h3>Itens comprados</h3><p>Informe a quantidade de embalagens e o preço pago por embalagem.</p></div><button type="button" className="button button-outline" onClick={() => setLines(current => [...current, newLine(products[0]?.id ?? '')])}><Plus size={14}/> Adicionar item</button></div>
        <div className="purchase-lines">{lines.map((line, index) => {
          const product = products.find(row => row.id === line.productId)
          const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0)
          return <div className="purchase-line" key={line.id}><div className="purchase-line-top"><strong>Item {index + 1}</strong><button type="button" className="commerce-icon-button" disabled={lines.length === 1} onClick={() => setLines(current => current.filter(row => row.id !== line.id))} aria-label="Remover item"><Trash2 size={14}/></button></div><label>Produto<select className="text-input" value={line.productId} onChange={event => updateLine(line.id, { productId: event.target.value })} required><option value="">Selecione do catálogo...</option>{products.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><div className="purchase-line-grid"><label>Quantidade ({product?.purchase_unit_label ?? 'embalagem'})<input className="text-input" type="number" min="0.001" step="0.001" value={line.quantity} onChange={event => updateLine(line.id, { quantity: event.target.value })} required/></label><label>Preço por embalagem (R$)<input className="text-input" type="number" min="0" step="0.01" value={line.unitPrice} onChange={event => updateLine(line.id, { unitPrice: event.target.value })} placeholder="0,00" required/></label><label>Validade do lote<input className="text-input" type="date" value={line.expiresOn} onChange={event => updateLine(line.id, { expiresOn: event.target.value })}/></label></div><div className="purchase-line-total"><span>Subtotal do item</span><strong>{currency(lineTotal)}</strong></div></div>
        })}</div>
        <div className="commerce-form purchase-meta-grid"><label>Desconto total (R$)<input className="text-input" type="number" min="0" step="0.01" value={discount} onChange={event => setDiscount(event.target.value)}/></label><label>Observações (opcional)<input className="text-input" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ex.: compra semanal"/></label></div>
        <div className="purchase-total-box"><div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div><div><span>Desconto</span><strong>- {currency(discountValue)}</strong></div><div className="purchase-grand-total"><span>Total da compra</span><strong>{currency(total)}</strong></div></div>
        <button className="button button-primary purchase-submit" disabled={saving || loading || products.length === 0 || lines.length === 0}><CheckCircle2 size={16}/>{saving ? 'Confirmando compra...' : 'Confirmar compra e atualizar estoque'}</button>
      </form>
      <aside className="purchase-aside">
        <section className="panel receipt-upload-panel">
          <div className="panel-heading"><div><h2>Importar nota fiscal</h2><p>Leia o QR, tente importar os itens ou anexe a nota.</p></div><FileText size={19}/></div>
          <div className="qr-import-box"><div><strong>Ler QR da nota</strong><small>Válido para NFC-e (modelo 65).</small></div><button type="button" className="button button-outline" onClick={() => setScannerOpen(true)}><ScanLine size={15}/> Abrir câmera</button></div>
          {qrInfo && <div className="qr-result"><CheckCircle2 size={15}/><span><strong>{qrInfo.isValidNfce ? 'NFC-e reconhecida' : 'Código reconhecido'}</strong><small>{qrInfo.chave || qrInfo.raw.slice(0, 60)}{qrInfo.uf ? ` · UF ${qrInfo.uf}` : ''}{qrInfo.purchasedAt ? ` · ${qrInfo.purchasedAt}` : ''}</small></span></div>}
          <label className="qr-manual-label">QR / chave de acesso (se a câmera não funcionar)<textarea className="text-input" rows={2} value={qrManual} onChange={event => setQrManual(event.target.value)} placeholder="Cole a URL do QR ou os 44 dígitos da chave"/></label>
          <div className="qr-actions"><button type="button" className="button button-outline" disabled={!qrManual.trim() || qrBusy} onClick={() => handleQrDetect(qrManual)}>Interpretar texto</button><button type="button" className="button button-primary" disabled={!qrInfo?.url || qrBusy} onClick={() => void importFromQrUrl()}>{qrBusy ? 'Consultando...' : 'Tentar importar itens'}</button>{qrInfo?.url && <a className="button button-outline" href={qrInfo.url} target="_blank" rel="noreferrer">Abrir consulta <ExternalLink size={14}/></a>}</div>
          <details className="qr-xml"><summary>Colar XML da nota (opcional)</summary><textarea className="text-input" rows={4} value={xmlText} onChange={event => setXmlText(event.target.value)} placeholder="Cole aqui o conteúdo do arquivo .xml"/><button type="button" className="button button-outline full-button" disabled={!xmlText.trim()} onClick={importFromXml}>Importar itens do XML</button></details>
          <label className="receipt-dropzone"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={event => setReceiptFile(event.target.files?.[0] ?? null)}/>{receiptFile ? <><FileImage size={27}/><strong>{receiptFile.name}</strong><small>{(receiptFile.size / 1024 / 1024).toFixed(2)} MB · arquivo selecionado</small></> : <><UploadCloud size={28}/><strong>Selecionar nota ou fotografar</strong><small>JPG, PNG, WEBP ou PDF · até 15 MB</small></>}</label>{receiptFile && <button type="button" className="button button-outline full-button" onClick={() => setReceiptFile(null)}>Remover anexo</button>}
          <div className="settings-note"><AlertCircle size={15}/><span>O QR da NFC-e contém a chave da nota, não a lista de itens. Quando a consulta não devolver os produtos, confirme manualmente ou cole o XML. Nunca informe chaves secretas do Supabase aqui.</span></div>
        </section>
        <section className="panel barcode-panel"><div className="panel-heading"><div><h2>Adicionar por código de barras</h2><p>Digite ou leia com um scanner USB/Bluetooth.</p></div><ScanBarcode size={19}/></div><form className="barcode-form" onSubmit={addScannedBarcode}><label>Código EAN/GTIN<input className="text-input" inputMode="numeric" value={barcode} onChange={event => setBarcode(event.target.value)} placeholder="Ex.: 7891234567890"/></label><button className="button button-outline" disabled={!barcode.trim() || loading}><Plus size={14}/> Localizar produto</button></form><small className="commerce-muted">O código precisa estar cadastrado no produto da despensa. A leitura pela câmera será habilitada em uma próxima integração do scanner nativo.</small></section>
        <section className="panel purchase-stock-note"><div className="panel-heading"><div><h2>O que acontece ao confirmar?</h2></div></div><ul><li>Uma compra é registrada no histórico.</li><li>Os itens entram no estoque como novos lotes.</li><li>As datas de validade ficam vinculadas aos lotes.</li><li>Os preços alimentam o histórico por mercado.</li><li>Itens correspondentes da lista ativa são marcados como comprados.</li></ul></section>
      </aside>
    </div>
    {scannerOpen && <QrScanner onDetect={handleQrDetect} onClose={() => setScannerOpen(false)} />}
  </div>
}
