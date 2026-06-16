import { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { usePortfolio } from '../context/PortfolioContext'
import { Card, SectionTitle, EmptyState } from '../components/common/ui'
import { inr, fmtDate } from '../analytics/format'

const BLANK = { symbol: '', name: '', type: 'BUY', date: new Date().toISOString().slice(0, 10), quantity: '', price: '', notes: '' }

// Map a loosely-shaped CSV row (Paytm tradebook or generic) to a transaction.
// Tries a range of common header names so most exports "just work".
function rowToTxn(row) {
  const get = (...keys) => {
    for (const k of Object.keys(row)) {
      const norm = k.toLowerCase().replace(/[^a-z]/g, '')
      if (keys.includes(norm)) return row[k]
    }
    return undefined
  }
  const rawType = String(get('type', 'side', 'transactiontype', 'buysell', 'ordertype') || '').toUpperCase()
  const type = rawType.startsWith('S') ? 'SELL' : 'BUY'
  const rawDate = get('date', 'tradedate', 'orderdate', 'transactiondate', 'exchangetime')
  let date = ''
  if (rawDate) {
    const d = new Date(rawDate)
    date = Number.isNaN(d.getTime()) ? String(rawDate).slice(0, 10) : d.toISOString().slice(0, 10)
  }
  return {
    symbol: String(get('symbol', 'tradingsymbol', 'scrip', 'nsesymbol', 'instrument', 'stock') || '').trim().toUpperCase(),
    name: get('name', 'companyname', 'displayname') || null,
    type,
    date,
    quantity: Number(get('quantity', 'qty', 'shares', 'filledqty') || 0),
    price: Number(get('price', 'avgprice', 'tradeprice', 'avgtradedprice', 'rate') || 0),
    notes: get('notes', 'remarks') || null,
    source: 'csv',
  }
}

export default function Ledger() {
  const { transactions, addTxn, editTxn, removeTxn, importTxns } = usePortfolio()
  const [form, setForm] = useState(BLANK)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
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

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        const rows = (res.data || []).map(rowToTxn).filter((t) => t.symbol && t.quantity > 0 && t.date)
        if (!rows.length) {
          setMsg({ type: 'error', text: 'No valid rows found. Expected columns like symbol, type, date, quantity, price.' })
          return
        }
        setBusy(true)
        try {
          const r = await importTxns(rows)
          setMsg({ type: 'ok', text: `Imported ${r?.added ?? rows.length} transactions.` })
        } catch (err) {
          setMsg({ type: 'error', text: err.message })
        } finally {
          setBusy(false)
          if (fileRef.current) fileRef.current.value = ''
        }
      },
      error: (err) => setMsg({ type: 'error', text: err.message }),
    })
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
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30"
            >
              📥 Import CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={onFile} className="hidden" />
          </div>
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
          CSV import accepts Paytm tradebook / generic exports — columns like symbol, type, date, quantity, price.
        </p>
      </Card>

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
