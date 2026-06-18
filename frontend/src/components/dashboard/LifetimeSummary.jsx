import { useMemo } from 'react'
import { usePortfolio } from '../../context/PortfolioContext'
import { lifetimeSummary } from '../../analytics/opportunities'
import { Card, SectionTitle } from '../common/ui'
import { money, moneyCompact, pct, signClass } from '../../analytics/format'

function Metric({ label, value, sub, tone }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${tone || 'text-slate-900 dark:text-slate-100'}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

/**
 * All-time portfolio performance from the full ledger (realized + unrealized), grouped
 * by currency. This is the lifetime P&L / invested / exit-value rollup across every stock.
 */
export default function LifetimeSummary() {
  const { journeys } = usePortfolio()
  const groups = useMemo(() => lifetimeSummary(journeys || []), [journeys])
  if (!groups.length) return null

  return (
    <Card className="p-4">
      <SectionTitle title="Lifetime Performance" subtitle="All-time totals across every stock you've ever traded" />
      {groups.map((g) => (
        <div key={g.currency} className="mb-2 last:mb-0">
          {groups.length > 1 && (
            <div className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{g.currency}</div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Total Invested" value={money(g.invested, g.currency)} sub={`lifetime · ${moneyCompact(g.invested, g.currency)}`} />
            <Metric label="Total Exit Value" value={money(g.exitValue, g.currency)} sub="from all sells" />
            <Metric label="Realized P&L" value={money(g.realized, g.currency)} tone={signClass(g.realized)} sub="booked" />
            <Metric label="Unrealized P&L" value={money(g.unrealized, g.currency)} tone={signClass(g.unrealized)} sub="on holdings" />
            <Metric label="Net P&L (All-time)" value={money(g.netPnl, g.currency)} tone={signClass(g.netPnl)} sub={pct(g.returnPct)} />
            <Metric label="Current Value" value={money(g.currentValue, g.currency)} sub={`cost ${moneyCompact(g.openCost, g.currency)}`} />
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {g.stocks} stocks traded · {g.held} held · {g.exited} fully exited · {g.winners} winners / {g.losers} losers
          </div>
        </div>
      ))}
    </Card>
  )
}
