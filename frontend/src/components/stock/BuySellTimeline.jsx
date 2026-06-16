import { useMemo, useState } from 'react'
import { Card, SectionTitle, EmptyState } from '../common/ui'
import { inr, fmtDate } from '../../analytics/format'

/**
 * Chronological BUY/SELL timeline for one stock, built from the lifetime ledger (F2).
 * Filterable by side (Buy/Sell) and date range. Shows date, type, qty, price, value, notes.
 *
 * @param {Array} transactions  ledger txns for this symbol [{type,date,quantity,price,notes}]
 */
export default function BuySellTimeline({ transactions = [] }) {
  const [side, setSide] = useState('ALL') // ALL | BUY | SELL
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtered = useMemo(() => {
    return [...transactions]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .filter((t) => (side === 'ALL' ? true : t.type === side))
      .filter((t) => (from ? t.date >= from : true))
      .filter((t) => (to ? t.date <= to : true))
  }, [transactions, side, from, to])

  if (!transactions.length) {
    return (
      <Card className="p-4">
        <SectionTitle title="Buy / Sell Timeline" />
        <EmptyState
          icon="📅"
          title="No transactions yet"
          message="Add trades for this stock, or import your tradebook, to see the full timeline."
        />
      </Card>
    )
  }

  const Seg = ({ v, label }) => (
    <button
      onClick={() => setSide(v)}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
        side === v
          ? 'bg-indigo-600 text-white'
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
      }`}
    >
      {label}
    </button>
  )

  return (
    <Card className="p-4">
      <SectionTitle
        title="Buy / Sell Timeline"
        subtitle={`${filtered.length} of ${transactions.length} transactions`}
        right={
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
            <Seg v="ALL" label="All" />
            <Seg v="BUY" label="Buy" />
            <Seg v="SELL" label="Sell" />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>From</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-slate-200 bg-transparent px-2 py-1 dark:border-white/10"
        />
        <span>To</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-slate-200 bg-transparent px-2 py-1 dark:border-white/10"
        />
        {(from || to) && (
          <button onClick={() => { setFrom(''); setTo('') }} className="text-indigo-500 hover:underline">
            clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No transactions match these filters.</p>
      ) : (
        <ol className="relative ml-3 border-l border-slate-200 dark:border-white/10">
          {filtered.map((t) => {
            const buy = t.type === 'BUY'
            return (
              <li key={t.id} className="mb-5 ml-5 last:mb-0">
                <span
                  className={`absolute -left-2.5 mt-1 h-5 w-5 rounded-full text-center text-[10px] font-bold leading-5 text-white ${buy ? 'bg-up' : 'bg-down'}`}
                >
                  {buy ? 'B' : 'S'}
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${buy ? 'text-up' : 'text-down'}`}>
                    {buy ? 'Bought' : 'Sold'} {t.quantity} @ ₹{inr(t.price)}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{fmtDate(t.date)}</span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {buy ? 'Investment' : 'Exit value'}: ₹{inr(t.quantity * t.price)}
                </div>
                {t.notes && (
                  <div className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">“{t.notes}”</div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
