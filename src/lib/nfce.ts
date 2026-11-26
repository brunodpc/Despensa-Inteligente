const UF_BY_CODE: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
}

export type NfceQrInfo = {
  raw: string
  chave: string
  url: string
  uf: string
  model: string
  purchasedAt: string
  total: number | null
  isValidNfce: boolean
}

export type NfceParsedItem = {
  name: string
  quantity: number
  unitPrice: number
}

export function parseNfceQr(rawValue: string): NfceQrInfo {
  const raw = rawValue.trim()
  let url = ''
  let chave = (raw.match(/\d{44}/) ?? [''])[0]
  let dhEmi = ''
  let vNF = ''

  if (/^https?:\/\//i.test(raw)) {
    url = raw
    try {
      const parsed = new URL(raw)
      chave = parsed.searchParams.get('chNFe') ?? parsed.searchParams.get('chave') ?? chave
      dhEmi = parsed.searchParams.get('dhEmi') ?? ''
      vNF = parsed.searchParams.get('vNF') ?? ''
    } catch {
      chave = chave.replace(/\D/g, '').slice(0, 44)
    }
  }

  chave = chave.replace(/\D/g, '').slice(0, 44)
  const total = Number(vNF)
  return {
    raw,
    chave,
    url,
    uf: UF_BY_CODE[chave.slice(0, 2)] ?? '',
    model: chave.slice(20, 22),
    purchasedAt: /^\d{4}-\d{2}-\d{2}/.test(dhEmi) ? dhEmi.slice(0, 10) : '',
    total: Number.isFinite(total) && total > 0 ? total : null,
    isValidNfce: chave.length === 44 && chave.slice(20, 22) === '65',
  }
}

export function parseNfceDocument(text: string): NfceParsedItem[] {
  const source = text.trim()
  if (!source) return []
  const doc = new DOMParser().parseFromString(source, 'application/xml')
  if (doc.querySelector('parsererror')) return []
  return Array.from(doc.querySelectorAll('det')).flatMap(det => {
    const name = det.querySelector('xProd')?.textContent?.trim() ?? ''
    const quantity = Number((det.querySelector('qCom')?.textContent ?? '1').replace(',', '.'))
    const productTotal = Number((det.querySelector('vProd')?.textContent ?? '0').replace(',', '.'))
    const unitPrice = quantity > 0 && Number.isFinite(productTotal) ? productTotal / quantity : 0
    if (!name || !Number.isFinite(quantity) || quantity <= 0) return []
    return [{ name, quantity, unitPrice }]
  })
}

export function normalizeProductName(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim()
}
