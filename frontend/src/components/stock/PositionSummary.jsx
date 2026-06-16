import { Card, SectionTitle } from '../common/ui'
import { inr, pct, signClass } from '../../analytics/format'

function Row({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0 dark:border-white/5">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${accent || 'text-slate-800 dark:text-slate-200'}`}>{value}</span>
    </div>
  )
}

export default function PositionSummary({ holding }) {
  const h = holding
  return (
    <Card className="p-4">
      <SectionTitle title="Position Summary" />
      <Row label="Current Shares Held" value={h.quantity} />
      <Row label="Average Purchase Price" value={`₹${inr(h.avgPrice)}`} />
      <Row label="Current Market Price" value={`₹${inr(h.lastPrice)}`} />
      <Row label="Total Investment" value={`₹${inr(h.invested)}`} />
      <Row label="Current Market Value" value={`₹${inr(h.currentValue)}`} />
      <Row label="Total Returns" value={`₹${inr(h.pnl)}`} accent={signClass(h.pnl)} />
      <Row label="Return %" value={pct(h.pnlPct)} accent={signClass(h.pnlPct)} />
      <p className="mt-3 text-xs text-slate-400">
        Shares bought/sold totals & avg selling price require lifetime trade history (tradebook).
      </p>
    </Card>
  )
}
