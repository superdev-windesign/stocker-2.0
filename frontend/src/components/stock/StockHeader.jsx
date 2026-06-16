import { StatPill } from '../common/ui'
import { inr } from '../../analytics/format'

export default function StockHeader({ holding }) {
  const h = holding
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{h.symbol}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{h.name}</p>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          <Tag>{h.exchange}</Tag>
          <Tag>{h.sector}</Tag>
          <Tag>{h.industry}</Tag>
          <Tag>{h.cap} cap</Tag>
        </div>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">₹{inr(h.lastPrice)}</div>
        <div className="flex items-center justify-end gap-2">
          <StatPill value={h.dayChangePct} />
          <span className="text-xs text-slate-500">today</span>
        </div>
      </div>
    </div>
  )
}

function Tag({ children }) {
  return (
    <span className="rounded-md border border-slate-200 px-1.5 py-0.5 text-slate-600 dark:border-white/10 dark:text-slate-300">
      {children}
    </span>
  )
}
