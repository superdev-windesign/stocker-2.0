import { useMemo } from 'react'
import { usePortfolio } from '../../context/PortfolioContext'
import { realizedSummary } from '../../analytics/opportunities'
import { Card, SectionTitle, EmptyState } from '../common/ui'
import { inr, pct, signClass } from '../../analytics/format'

const fmtDays = (d) => (d == null ? '—' : d < 365 ? `${d}d` : `${(d / 365).toFixed(1)}y`)

export default function RealizedProfit() {
  const { journeys } = usePortfolio()
  const r = useMemo(() => realizedSummary(journeys || []), [journeys])

  if (!r.closedCount) {
    return (
      <Card className="p-4">
        <SectionTitle title="Realized Profit Analysis" subtitle="Closed positions (sold stocks)" />
        <EmptyState
          icon="💰"
          title="No closed positions yet"
          message="Once you record sells in the Ledger (or import your tradebook), realized gains, win rate and holding periods appear here."
        />
      </Card>
    )
  }

  const cards = [
    { label: 'Net Realized P&L', value: `₹${inr(r.netRealized)}`, tone: signClass(r.netRealized) },
    { label: 'Total Realized Gains', value: `₹${inr(r.totalRealizedGains)}`, tone: 'text-up' },
    { label: 'Total Realized Losses', value: `₹${inr(r.totalRealizedLosses)}`, tone: 'text-down' },
    { label: 'Win Rate', value: r.winRate == null ? '—' : pct(r.winRate).replace('+', ''), tone: '' },
    { label: 'Avg Holding Period', value: fmtDays(r.avgHoldingDays), tone: '' },
    { label: 'Closed Positions', value: r.closedCount, tone: '' },
  ]

  return (
    <Card className="p-4">
      <SectionTitle title="Realized Profit Analysis" subtitle={`${r.closedCount} stocks with completed sells`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
            <div className="text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className={`mt-0.5 text-lg font-bold tabular-nums ${c.tone || 'text-slate-900 dark:text-slate-100'}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
