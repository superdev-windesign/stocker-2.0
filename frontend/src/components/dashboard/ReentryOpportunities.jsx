import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio } from '../../context/PortfolioContext'
import { reentryOpportunities } from '../../analytics/opportunities'
import { Card, SectionTitle, StatPill, EmptyState } from '../common/ui'
import { inr } from '../../analytics/format'
import DataTable from '../common/DataTable'

/**
 * Re-Entry Opportunities (F8): stocks you fully exited that are now trading below your
 * last sell price — sorted by biggest drop. Shows a suggested re-entry zone.
 */
export default function ReentryOpportunities() {
  const { journeys } = usePortfolio()
  const navigate = useNavigate()
  const rows = useMemo(() => reentryOpportunities(journeys || []), [journeys])

  if (!rows.length) {
    return (
      <Card className="p-4">
        <SectionTitle title="Re-Entry Opportunities" subtitle="Exited stocks now trading below your last exit" />
        <EmptyState
          icon="🎯"
          title="No re-entry opportunities right now"
          message="When a stock you've fully sold drops back below your last exit price, it shows up here as a potential re-entry."
        />
      </Card>
    )
  }

  const columns = [
    { key: 'symbol', label: 'Stock', render: (r) => (
      <div>
        <div className="font-medium text-slate-900 dark:text-slate-100">{r.symbol}</div>
        <div className="text-xs text-slate-400">{r.name}</div>
      </div>
    ) },
    { key: 'lastSellPrice', label: 'Last Sold', align: 'right', render: (r) => `₹${inr(r.lastSellPrice)}` },
    { key: 'lastPrice', label: 'Current', align: 'right', render: (r) => `₹${inr(r.lastPrice)}` },
    { key: 'diffPct', label: 'Diff %', align: 'right', render: (r) => <StatPill value={r.diffPct} /> },
    {
      key: 'zone',
      label: 'Suggested Re-Entry Zone',
      sortable: false,
      align: 'right',
      render: (r) => (r.zone ? `₹${inr(r.zone.low)} – ₹${inr(r.zone.high)}` : '—'),
      csv: (r) => (r.zone ? `${r.zone.low.toFixed(2)}-${r.zone.high.toFixed(2)}` : ''),
    },
    {
      key: 'inZone',
      label: 'Status',
      align: 'right',
      sortable: false,
      render: (r) =>
        r.inZone ? (
          <span className="rounded-md bg-up/10 px-1.5 py-0.5 text-xs font-semibold text-up">In re-entry zone</span>
        ) : (
          <span className="text-xs text-slate-400">Watching</span>
        ),
    },
    {
      key: 'alert',
      label: '',
      align: 'right',
      sortable: false,
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            const q = new URLSearchParams({
              type: 'REENTRY_ZONE',
              symbol: r.symbol,
              threshold: String(Math.round(r.lastSellPrice)),
              ...(r.securityId ? { securityId: String(r.securityId) } : {}),
            })
            navigate(`/alerts?${q}`)
          }}
          className="rounded-md border border-indigo-500/40 px-2 py-1 text-xs font-medium text-indigo-500 hover:bg-indigo-500/10"
        >
          + Alert
        </button>
      ),
    },
  ]

  return (
    <Card className="p-4">
      <SectionTitle
        title="Re-Entry Opportunities"
        subtitle={`${rows.length} exited ${rows.length === 1 ? 'stock is' : 'stocks are'} below your last exit price`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(r) => r.securityId && navigate(`/stock/${r.securityId}`)}
        csvName="reentry-opportunities.csv"
        initialSort={{ key: 'diffPct', dir: 'asc' }}
      />
    </Card>
  )
}
