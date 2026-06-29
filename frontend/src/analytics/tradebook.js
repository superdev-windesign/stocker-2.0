// Shared utilities for parsing broker tradebook files (CSV / Excel).
// Handles Paytm Money, Zerodha, Groww, Upstox, Angel One, and generic tradebook formats.
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const normKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

export function parseDate(raw) {
  if (raw == null || raw === '') return ''
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString().slice(0, 10)
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (m) {
    let [, dd, mm, yy] = m
    yy = yy.length === 2 ? `20${yy}` : yy
    return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s.slice(0, 10) : d.toISOString().slice(0, 10)
}

// Detect the real header row (has Date + Type + Quantity), skip metadata preambles.
// Supports both plain column names ("Date") and compound ones ("Trade Date", "Order Date").
export function aoaToObjects(aoa) {
  let hi = aoa.findIndex((r) => {
    const cells = (r || []).map(normKey)
    const hasDate = cells.some((c) => ['date', 'tradedate', 'orderdate', 'transactiondate', 'tradedatetime', 'datetime'].includes(c))
    const hasType = cells.some((c) => ['type', 'transactiontype', 'tradetype', 'buysell', 'trade', 'action', 'orderside', 'ordertype'].includes(c))
    const hasQty  = cells.some((c) => ['quantity', 'qty', 'tradedqty', 'tradeqty', 'netqty', 'shares', 'filledqty'].includes(c))
    return hasDate && hasType && hasQty
  })
  if (hi < 0) hi = 0  // no preamble — treat row 0 as header
  const headers = (aoa[hi] || []).map((h) => String(h))
  const out = []
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i]
    if (!r || r.every((c) => c === '' || c == null)) continue
    const obj = {}
    headers.forEach((h, j) => { if (h) obj[h] = r[j] })
    out.push(obj)
  }
  return out
}

export function sumCharges(row) {
  const keys = ['brokerage', 'ett', 'gst', 'stt', 'sebi', 'stampduty', 'transactioncharges', 'charges',
                 'exchangecharges', 'sebicharges', 'dpcharges', 'othercharges', 'stampduty', 'turnovercharges']
  let s = 0
  for (const k of Object.keys(row)) {
    if (keys.includes(normKey(k))) s += Number(row[k]) || 0
  }
  return Math.round(s * 100) / 100
}

export function rowToTxn(row) {
  const get = (...keys) => {
    for (const k of Object.keys(row)) {
      if (keys.includes(normKey(k))) return row[k]
    }
    return undefined
  }

  // BUY / SELL detection — covers: Type, Trade Type, Trade, Action, Order Side, Buy or Sell
  const rawType = String(
    get('type', 'side', 'transactiontype', 'buysell', 'ordertype', 'tradetype',
        'trade', 'action', 'orderside', 'b', 'buyorsell', 'tradeaction') || '',
  ).toUpperCase()
  const type = rawType.startsWith('S') ? 'SELL' : 'BUY'

  // Dedup — prefer Trade ID / Trade Number, fall back to Order ID.
  // When no ID column exists, build a synthetic fingerprint so re-uploading the same
  // file doesn't create duplicates (same date+symbol+type+qty+price = same trade).
  const tradeNo = String(get('tradenumber', 'tradeno', 'tradeid', 'tradereferencenumber') || '').trim()
  const orderNo = String(get('ordernumber', 'orderno', 'orderid', 'orderreferencenumber') || '').trim()
  const brokerExtId = tradeNo && tradeNo !== '0' ? tradeNo : orderNo && orderNo !== '0' ? orderNo : null

  // Symbol — try many broker column names; fall back to company name if nothing else
  const sym = String(
    get('symbol', 'script', 'tradingsymbol', 'scrip', 'scripname', 'nsesymbol', 'bsesymbol',
        'instrument', 'stock', 'security', 'scripcode', 'securityname', 'instrumentname',
        'stockname', 'equitysymbol', 'name', 'companyname', 'displayname', 'assetname') || '',
  ).trim().toUpperCase()

  // Quantity — covers: Qty, Trade Qty, Net Qty, Filled Qty, Traded Quantity
  const quantity = Number(
    get('quantity', 'qty', 'shares', 'filledqty', 'tradedqty', 'tradedquantity', 'filledquantity',
        'tradeqty', 'netqty', 'tradedqtys', 'executedqty', 'totalqty') || 0,
  )

  // Price — covers: Price, Avg Price, Trade Price, Average Price, Net Rate, Execution Price
  const price = Number(
    get('price', 'avgprice', 'tradeprice', 'tradedprice', 'avgtradedprice', 'rate',
        'tradedpriceperunit', 'averageprice', 'avgbuyprice', 'avgsellprice', 'netrate',
        'netprice', 'execprice', 'executionprice', 'avgexecutedprice', 'tradevalue') || 0,
  )

  const date = parseDate(get('date', 'tradedate', 'orderdate', 'transactiondate', 'exchangetime', 'tradetime', 'datetime', 'tradedatetime'))
  // Synthetic fingerprint dedup: same trade uploaded twice → same extId → skipped on re-import.
  const extId = brokerExtId || `fp:${sym}|${date}|${type}|${quantity}|${price}`

  return {
    symbol: sym,
    isin: String(get('isin', 'isincode', 'isinno') || '').trim() || null,
    name: get('name', 'companyname', 'displayname', 'scripname', 'securityname', 'stockname') || null,
    exchange: String(get('exchange', 'exchangesegment', 'exch', 'market', 'segment') || 'NSE').replace(/[^A-Za-z]/g, '').toUpperCase() || 'NSE',
    type,
    date,
    quantity,
    price,
    charges: sumCharges(row),
    notes: get('notes', 'remarks') || null,
    source: 'csv',
    extId,
  }
}

// BSE numeric scrip codes → real ticker via ISIN lookup
export function remapNumericSymbols(rows, holdings = []) {
  const isNumeric = (s) => /^\d+$/.test(String(s))
  const isinToSymbol = {}
  for (const h of holdings) if (h.isin && h.symbol && !isNumeric(h.symbol)) isinToSymbol[h.isin] = h.symbol
  for (const r of rows) if (r.isin && !isNumeric(r.symbol)) isinToSymbol[r.isin] = r.symbol
  return rows.map((r) => (isNumeric(r.symbol) && r.isin && isinToSymbol[r.isin] ? { ...r, symbol: isinToSymbol[r.isin] } : r))
}

// Parse a file (CSV / Excel) → raw array-of-arrays
export function parseFileToAoa(file) {
  return new Promise((resolve, reject) => {
    const name = file.name.toLowerCase()
    if (name.endsWith('.csv') || file.type === 'text/csv') {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data || []),
        error: reject,
      })
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true })
          const ws = wb.Sheets[wb.SheetNames[0]]
          resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }))
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('Could not read file'))
      reader.readAsArrayBuffer(file)
    }
  })
}

// Detect which broker the file looks like, based on header columns found.
export function detectBrokerFormat(headers) {
  const h = headers.map(normKey)
  if (h.includes('tradeid') || h.includes('orderid')) return 'Zerodha'
  if (h.includes('tradenumber') || h.includes('ordernumber')) return 'Paytm Money'
  if (h.includes('tradeqty') || h.includes('netqty')) return 'Groww / Upstox'
  if (h.includes('isinno') || h.includes('companyname')) return 'Angel One'
  return 'Generic'
}

// High-level: parse a tradebook file → clean transaction rows ready for import.
// Returns { rows, headers, broker, rawCount } — so callers can give better error messages.
export async function parseTradebookFile(file, holdings = []) {
  const aoa = await parseFileToAoa(file)
  if (!aoa.length) return { rows: [], headers: [], broker: null, rawCount: 0 }

  const objects = aoaToObjects(aoa)
  const headers = objects.length > 0 ? Object.keys(objects[0]) : []
  const broker = detectBrokerFormat(headers)
  const parsed = objects.map(rowToTxn).filter((t) => t.symbol && t.quantity > 0 && t.date)
  const rows = remapNumericSymbols(parsed, holdings)
  return { rows, headers, broker, rawCount: aoa.length - 1 }
}
