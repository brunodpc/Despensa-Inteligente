export type ShoppingPdfItem = {
  name: string
  quantityLabel: string
  detail?: string
  priceLabel?: string
  checked?: boolean
}

export type ShoppingPdfData = {
  householdName: string
  listName: string
  pending: ShoppingPdfItem[]
  checked: ShoppingPdfItem[]
  estimatedTotalLabel: string
  budgetLabel?: string
  generatedAt?: Date
}

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 44

function escapePdfText(value: string) {
  let output = ''
  for (const character of value) {
    const code = character.codePointAt(0) ?? 63
    if (character === '\\' || character === '(' || character === ')') output += `\\${character}`
    else if (code >= 32 && code <= 126) output += character
    else if (code >= 160 && code <= 255) output += `\\${code.toString(8).padStart(3, '0')}`
    else output += '?'
  }
  return output
}

function textCommand(value: string, x: number, y: number, size: number, bold: boolean) {
  const font = bold ? 'F2' : 'F1'
  return `BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfText(value)}) Tj ET`
}

function wrapText(value: string, maxChars: number) {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) { current = word; continue }
    if (`${current} ${word}`.length > maxChars) { lines.push(current); current = word }
    else current = `${current} ${word}`
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(value)
}

export function buildShoppingListPdf(data: ShoppingPdfData): Blob {
  const generatedAt = data.generatedAt ?? new Date()
  const pages: string[][] = []
  let commands: string[] = []
  let y = 0
  let currentPage = 0

  function drawLine(position: number) {
    commands.push(`0.82 0.86 0.81 RG 0.8 w ${MARGIN} ${position.toFixed(2)} m ${(PAGE_WIDTH - MARGIN).toFixed(2)} ${position.toFixed(2)} l S`)
  }

  function startPage() {
    currentPage += 1
    commands = []
    y = PAGE_HEIGHT - 54
    commands.push(textCommand('DESPENSA INTELIGENTE', MARGIN, y, 8, true))
    commands.push(textCommand(`Gerado em ${formatDate(generatedAt)}`, PAGE_WIDTH - MARGIN - 150, y, 7.5, false))
    y -= 12
    drawLine(y)
    y -= 24
  }

  function finishPage() {
    commands.push(textCommand('Leve este PDF ao mercado: funciona sem internet.', MARGIN, 34, 7.5, false))
    commands.push(textCommand(`Pagina ${currentPage}`, PAGE_WIDTH - MARGIN - 36, 34, 7.5, false))
    pages.push(commands)
  }

  function ensure(space: number) {
    if (y - space >= 58) return
    finishPage()
    startPage()
  }

  function write(value: string, size = 9, bold = false, gap = 5) {
    ensure(size + gap)
    commands.push(textCommand(value, MARGIN + 18, y, size, bold))
    y -= size + gap
  }

  function writePair(left: string, right: string, size = 9, bold = false, gap = 6) {
    ensure(size + gap)
    commands.push(textCommand(left, MARGIN + 18, y, size, bold))
    commands.push(textCommand(right, PAGE_WIDTH - MARGIN - 18 - right.length * size * 0.48, y, size, bold))
    y -= size + gap
  }

  function sectionTitle(title: string, count: number) {
    ensure(28)
    y -= 6
    commands.push(textCommand(`${title.toUpperCase()}  (${count})`, MARGIN, y, 10, true))
    y -= 6
    drawLine(y)
    y -= 16
  }

  function addItem(item: ShoppingPdfItem) {
    ensure(58)
    const boxX = MARGIN + 2
    const boxY = y - 8
    commands.push(`0.55 0.64 0.55 RG 0.9 w ${boxX} ${boxY.toFixed(2)} 10 10 re S`)
    if (item.checked) {
      commands.push(`0.22 0.38 0.26 RG 1.4 w ${boxX + 2} ${boxY + 5} l ${boxX + 4} ${boxY + 2} l ${boxX + 8} ${boxY + 8} l S`)
    }
    const nameLines = wrapText(item.name, 58)
    commands.push(textCommand(nameLines[0] ?? item.name, MARGIN + 20, y, 9.5, true))
    if (item.priceLabel) {
      commands.push(textCommand(item.priceLabel, PAGE_WIDTH - MARGIN - 18 - item.priceLabel.length * 9.5 * 0.48, y, 9.5, true))
    }
    y -= 12
    for (const line of nameLines.slice(1)) {
      commands.push(textCommand(line, MARGIN + 20, y, 8.5, false))
      y -= 10
    }
    if (item.detail) {
      commands.push(textCommand(wrapText(item.detail, 66)[0] ?? item.detail, MARGIN + 20, y, 8, false))
      y -= 11
    }
    commands.push(textCommand(item.quantityLabel, MARGIN + 20, y, 8, false))
    y -= 13
    drawLine(y + 3)
    y -= 6
  }

  startPage()
  commands.push(textCommand(data.listName || 'Lista de compras', MARGIN, y, 19, true))
  y -= 20
  commands.push(textCommand(`Residencia: ${data.householdName || 'Minha casa'}`, MARGIN, y, 9, false))
  y -= 16
  drawLine(y)
  y -= 18
  writePair('Itens pendentes', String(data.pending.length), 9.5, true)
  writePair('Ja separados', String(data.checked.length), 9.5, false)
  writePair('Estimativa registrada', data.estimatedTotalLabel, 9.5, false)
  if (data.budgetLabel) writePair('Orçamento da lista', data.budgetLabel, 9.5, false)
  y -= 8

  sectionTitle('Pendentes', data.pending.length)
  if (!data.pending.length) write('Nenhum item pendente. O estoque esta em dia.')
  for (const item of data.pending) addItem(item)

  if (data.checked.length) {
    sectionTitle('Ja separados', data.checked.length)
    for (const item of data.checked) addItem(item)
  }
  finishPage()

  const pageIds = pages.map((_, index) => 6 + index * 2)
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ]
  pages.forEach((contentLines, index) => {
    const stream = `${contentLines.join('\n')}\n`
    const contentId = 5 + index * 2
    const pageId = 6 + index * 2
    objects[contentId - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`
  })

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets[index] = pdf.length
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  const bytes = new Uint8Array(pdf.length)
  for (let index = 0; index < pdf.length; index += 1) bytes[index] = pdf.charCodeAt(index) & 0xff
  return new Blob([bytes], { type: 'application/pdf' })
}

export function downloadShoppingListPdf(data: ShoppingPdfData) {
  const blob = buildShoppingListPdf(data)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `lista-de-compras-${date}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
