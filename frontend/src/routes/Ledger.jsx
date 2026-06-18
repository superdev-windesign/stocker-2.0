import { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { usePortfolio } from '../context/PortfolioContext'
import { buildHoldingSeedRows } from '../analytics/paytmSync'
import { Card, SectionTitle, EmptyState } from '../components/common/ui'
import { inr, fmtDate } from '../analytics/format'

const BLANK = { symbol: '', name: '', type: 'BUY', date: new Date().toISOString().slice(0, 10), quantity: '', price: '', notes: '' }

// Parse many date shapes incl. Indian DD-MM-YYYY / DD/MM/YYYY and Excel Date objects → YYYY-MM-DD.
function parseDate(raw) {
  if (raw == null || raw === '') return ''
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString().slice(0, 10)
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/) // DD-MM-YYYY / DD/MM/YYYY
  if (m) {
    let [, dd, mm, yy] = m
    yy = yy.length === 2 ? `20${yy}` : yy
    return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }
  const d = new Date(s) // e.g. "16 Jun 2026"
  return Number.isNaN(d.getTime()) ? s.slice(0, 10) : d.toISOString().slice(0, 10)
}

// Map a loosely-shaped tradebook row (Paytm/generic, CSV or Excel) to a transaction.
// Matches a wide range of header names so most broker exports "just work".
function rowToTxn(row) {
  const get = (...keys) => {
    for (const k of Object.keys(row)) {
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (keys.includes(norm)) return row[k]
    }
    return undefined
  }
  const rawType = String(
    get('type', 'side', 'transactiontype', 'buysell', 'ordertype', 'tradetype', 'b', 'buyorsell') || '',
  ).toUpperCase()
  const type = rawType.startsWith('S') ? 'SELL' : 'BUY'
  return {
    symbol: String(get('symbol', 'tradingsymbol', 'scrip', 'scripname', 'nsesymbol', 'instrument', 'stock', 'security') || '')
      .trim()
      .toUpperCase(),
    name: get('name', 'companyname', 'displayname') || null,
    type,
    date: parseDate(get('date', 'tradedate', 'orderdate', 'transactiondate', 'exchangetime', 'tradetime', 'datetime')),
    quantity: Number(get('quantity', 'qty', 'shares', 'filledqty', 'tradedqty', 'tradedquantity', 'filledquantity') || 0),
    price: Number(get('price', 'avgprice', 'tradeprice', 'tradedprice', 'avgtradedprice', 'rate', 'tradedpriceperunit') || 0),
    notes: get('notes', 'remarks') || null,
    source: 'csv',
  }
}

export default function Ledger() {
  const { transactions, holdings, addTxn, editTxn, removeTxn, importTxns, clearSyncedBaseline } = usePortfolio()
  const hasBaseline = transactions.some((t) => t.source === 'paytm')
  const [form, setForm] = useState(BLANK)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [preview, setPreview] = useState(null) // { rows, total, fileName }
  const fileRef = useRef(null)

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [transactions],
  )

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setMsg(null)
    const tx = {
      ...form,
      quantity: Number(form.quantity),
      price: Number(form.price),
      source: editingId ? form.source || 'manual' : 'manual',
    }
    if (!tx.symbol || !(tx.quantity > 0) || !(tx.price >= 0) || !tx.date) {
      setMsg({ type: 'error', text: 'Symbol, date, quantity (>0) and price are required.' })
      return
    }
    setBusy(true)
    try {
      if (editingId) await editTxn(editingId, tx)
      else await addTxn(tx)
      setForm(BLANK)
      setEditingId(null)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (t) => {
    setEditingId(t.id)
    setForm({
      symbol: t.symbol, name: t.name || '', type: t.type, date: t.date,
      quantity: String(t.quantity), price: String(t.price), notes: t.notes || '', source: t.source,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const syncFromPaytm = async () => {
    setMsg(null)
    const rows = buildHoldingSeedRows(holdings, transactions)
    if (!rows.length) {
      setMsg({ type: 'ok', text: 'Nothing new to sync — every current holding is already in your ledger.' })
      return
    }
    setBusy(true)
    try {
      const r = await importTxns(rows)
      setMsg({ type: 'ok', text: `Synced ${r?.added ?? rows.length} holdings from Paytm as baseline positions.` })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  // Parse a tradebook file (CSV or Excel) into raw row objects keyed by header.
  const parseRows = (file) =>
    new Promise((resolve, reject) => {
      const name = file.name.toLowerCase()
      if (name.endsWith('.csv') || file.type === 'text/csv') {
        Papa.parse(file, {
          header: true,
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
            resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }))
          } catch (err) {
            reject(err)
          }
        }
        reader.onerror = () => reject(new Error('Could not read file'))
        reader.readAsArrayBuffer(file)
      }
    })

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(null)
    try {
      const raw = await parseRows(file)
      const rows = raw.map(rowToTxn).filter((t) => t.symbol && t.quantity > 0 && t.date)
      if (!rows.length) {
        setMsg({ type: 'error', text: 'No valid rows found. Expected columns like symbol, type, date, quantity, price. Paste me the header row if it won’t parse.' })
      } else {
        setPreview({ rows, total: raw.length, fileName: file.name })
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirmImport = async () => {
    if (!preview) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await importTxns(preview.rows)
      setMsg({
        type: 'ok',
        text: `Imported ${r?.added ?? preview.rows.length} transactions${r?.replacedBaseline ? `, replaced ${r.replacedBaseline} Paytm baseline entr${r.replacedBaseline === 1 ? 'y' : 'ies'}` : ''}.`,
      })
      setPreview(null)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const input = 'rounded-md border border-slate-200 bg-transparent px-2 py-1.5 text-sm dark:border-white/10'

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Transaction Ledger"
        subtitle="Your complete lifetime buy/sell history — the source of truth for every stock journey"
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {editingId ? 'Edit transaction' : 'Add a transaction'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={syncFromPaytm}
              disabled={busy}
              title="Seed your ledger from current Paytm holdings"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:border-slate-400 disabled:opacity-50 dark:border-white/10 dark:hover:border-white/30"
            >
              🔄 Sync from Paytm
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30"
            >
              📥 Upload tradebook
            </button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={onFile} className="hidden" />
            {hasBaseline && (
              <button
                onClick={async () => {
                  setMsg(null)
                  setBusy(true)
                  try {
                    await clearSyncedBaseline()
                    setMsg({ type: 'ok', text: 'Cleared Paytm baseline placeholder entries.' })
                  } catch (err) {
                    setMsg({ type: 'error', text: err.message })
                  } finally {
                    setBusy(false)
                  }
                }}
                className="rounded-lg border border-down/40 px-3 py-1.5 text-sm font-medium text-down hover:bg-down/5"
              >
                🧹 Clear Paytm baseline
              </button>
            )}
          </div>
        </div>

        <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <b>Accurate history needs your tradebook.</b> Paytm's API only returns your <i>current</i> holding
          (avg price + quantity), not past trades or dates — so “Sync from Paytm” creates one approximate
          <i> baseline</i> buy dated today. For real dates and past sells, download your{' '}
          <b>Trade book</b> from Paytm Money (Reports/Statements) — <b>CSV or Excel</b> — and upload it here.
          You'll get a preview to confirm before it imports, and it replaces the baseline for those stocks
          automatically.
        </div>

        <form onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <input className={input} placeholder="Symbol *" value={form.symbol} onChange={set('symbol')} />
          <select className={input} value={form.type} onChange={set('type')}>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <input className={input} type="date" value={form.date} onChange={set('date')} />
          <input className={input} type="number" step="any" placeholder="Qty *" value={form.quantity} onChange={set('quantity')} />
          <input className={input} type="number" step="any" placeholder="Price *" value={form.price} onChange={set('price')} />
          <input className={`${input} col-span-2 lg:col-span-1`} placeholder="Notes" value={form.notes} onChange={set('notes')} />
          <div className="col-span-2 flex gap-2 sm:col-span-4 lg:col-span-7">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {editingId ? 'Save changes' : 'Add transaction'}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm(BLANK) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-white/10">
                Cancel
              </button>
            )}
          </div>
        </form>

        {msg && (
          <p className={`mt-3 text-sm ${msg.type === 'error' ? 'text-down' : 'text-up'}`}>{msg.text}</p>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Accepts Paytm tradebook / generic exports (CSV or Excel) — columns like symbol, type, date, quantity, price.
        </p>
      </Card>

      {preview && (
        <Card className="p-4">
          <SectionTitle
            title="Preview import"
            subtitle={`${preview.fileName} · ${preview.rows.length} valid of ${preview.total} rows`}
            right={
              <div className="flex gap-2">
                <button onClick={() => setPreview(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-white/10">
                  Cancel
                </button>
                <button
                  onClick={confirmImport}
                  disabled={busy}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Import {preview.rows.length} transactions
                </button>
              </div>
            }
          />
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-white/10">
                  <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Symbol</th><th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3 text-right">Qty</th><th className="py-2 pr-3 text-right">Price</th><th className="py-2 pr-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 50).map((t, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-1.5 pr-3 text-slate-500">{fmtDate(t.date)}</td>
                    <td className="py-1.5 pr-3 font-medium text-slate-900 dark:text-slate-100">{t.symbol}</td>
                    <td className={`py-1.5 pr-3 text-xs font-semibold ${t.type === 'BUY' ? 'text-up' : 'text-down'}`}>{t.type}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{t.quantity}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">₹{inr(t.price)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">₹{inr(t.quantity * t.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 50 && <p className="py-2 text-center text-xs text-slate-400">…and {preview.rows.length - 50} more</p>}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Check a few dates/prices match your tradebook, then import. Existing Paytm baseline entries for these
            stocks will be replaced.
          </p>
        </Card>
      )}

      <Card className="p-4">
        <SectionTitle title="All transactions" subtitle={`${transactions.length} total`} />
        {sorted.length === 0 ? (
          <EmptyState icon="🧾" title="No transactions yet" message="Add a trade above or import your tradebook CSV." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-white/10">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Symbol</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3 text-right">Price</th>
                  <th className="py-2 pr-3 text-right">Value</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-2 pr-3 text-slate-500">{fmtDate(t.date)}</td>
                    <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">{t.symbol}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs font-semibold ${t.type === 'BUY' ? 'text-up' : 'text-down'}`}>{t.type}</span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{t.quantity}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">₹{inr(t.price)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">₹{inr(t.quantity * t.price)}</td>
                    <td className="max-w-[16rem] truncate py-2 pr-3 text-slate-500" title={t.notes || ''}>{t.notes || '—'}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(t)} className="text-xs text-indigo-500 hover:underline">Edit</button>
                      <button onClick={() => removeTxn(t.id)} className="ml-3 text-xs text-down hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
