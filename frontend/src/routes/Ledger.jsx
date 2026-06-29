import { useMemo, useRef, useState } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { buildHoldingSeedRows } from '../analytics/paytmSync'
import { aoaToObjects, rowToTxn, remapNumericSymbols, parseFileToAoa } from '../analytics/tradebook'
import { Card, SectionTitle, EmptyState } from '../components/common/ui'
import { inr, fmtDate } from '../analytics/format'

const BLANK = { symbol: '', name: '', type: 'BUY', date: new Date().toISOString().slice(0, 10), quantity: '', price: '', notes: '' }

export default function Ledger() {
  const { transactions, holdings, addTxn, editTxn, removeTxn, importTxns, clearSyncedBaseline, clearAllTxns } = usePortfolio()
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

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(null)
    try {
      const aoa = await parseFileToAoa(file)
      const parsed = aoaToObjects(aoa).map(rowToTxn).filter((t) => t.symbol && t.quantity > 0 && t.date)
      const rows = remapNumericSymbols(parsed, holdings)
      if (!rows.length) {
        setMsg({ type: 'error', text: 'No valid rows found. Expected a tradebook with Date / Script / Type / Quantity / Price columns.' })
      } else {
        setPreview({ rows, total: aoa.length, fileName: file.name })
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
      const parts = [`Imported ${r?.added ?? preview.rows.length} transactions`]
      if (r?.skipped) parts.push(`skipped ${r.skipped} already-imported`)
      if (r?.replacedBaseline) parts.push(`replaced ${r.replacedBaseline} Paytm baseline`)
      setMsg({ type: 'ok', text: `${parts.join(', ')}.` })
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
          (avg price + quantity), not past trades or dates — so "Sync from Paytm" creates one approximate
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
              <button type="button" onClick={() => { setEditingId(null); setForm(BLANK) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm transition hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30">
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
                <button onClick={() => setPreview(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30">
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
        <SectionTitle
          title="All transactions"
          subtitle={`${transactions.length} total`}
          right={
            transactions.length > 0 && (
              <button
                onClick={async () => {
                  if (!window.confirm(`Delete all ${transactions.length} transactions? This cannot be undone — re-import your tradebook afterwards.`)) return
                  setBusy(true)
                  setMsg(null)
                  try {
                    await clearAllTxns()
                    setMsg({ type: 'ok', text: 'Cleared all transactions. Re-upload your tradebook for a clean import.' })
                  } catch (err) {
                    setMsg({ type: 'error', text: err.message })
                  } finally {
                    setBusy(false)
                  }
                }}
                className="rounded-lg border border-down/40 px-3 py-1.5 text-xs font-medium text-down hover:bg-down/5"
              >
                Clear all
              </button>
            )
          }
        />
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
