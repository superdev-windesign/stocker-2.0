import { useNavigate } from 'react-router-dom'
import { Card, SectionTitle, StatPill } from '../common/ui'
import DataTable from '../common/DataTable'
import { allocationPct } from '../../analytics/portfolioMetrics'
import { inr, signClass } from '../../analytics/format'

export default function HoldingsTable({ holdings }) {
  const navigate = useNavigate()
  const rows = allocationPct(holdings).map((h) => ({ ...h, id: h.securityId || h.symbol }))

  const columns = [
    { key: 'symbol', label: 'Symbol', render: (r) => (
      <div>
        <div className="font-semibold text-slate-900 dark:text-slate-100">{r.symbol}</div>
        <div className="max-w-[160px] truncate text-xs text-slate-500">{r.name}</div>
      </div>
    ) },
    { key: 'sector', label: 'Sector', render: (r) => <span className="text-xs">{r.sector}</span> },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'avgPrice', label: 'Avg', align: 'right', render: (r) => inr(r.avgPrice) },
    { key: 'lastPrice', label: 'LTP', align: 'right', render: (r) => inr(r.lastPrice) },
    { key: 'invested', label: 'Invested', align: 'right', render: (r) => inr(r.invested) },
    { key: 'currentValue', label: 'Value', align: 'right', render: (r) => inr(r.currentValue) },
    { key: 'pnl', label: 'P&L', align: 'right', render: (r) => (
      <span className={signClass(r.pnl)}>{inr(r.pnl)}</span>
    ) },
    { key: 'pnlPct', label: 'P&L %', align: 'right', render: (r) => <StatPill value={r.pnlPct} /> },
    { key: 'dayChangePct', label: 'Day %', align: 'right', render: (r) => <StatPill value={r.dayChangePct} /> },
    { key: 'allocationPct', label: 'Alloc %', align: 'right', render: (r) => `${r.allocationPct.toFixed(1)}%` },
  ]

  return (
    <Card className="p-4">
      <SectionTitle title="Holdings" subtitle={`${holdings.length} stocks · click a row for full analytics`} />
      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(r) => r.securityId && navigate(`/stock/${r.securityId}`)}
        csvName="stocker-holdings.csv"
        searchKeys={['symbol', 'name', 'sector']}
        initialSort={{ key: 'currentValue', dir: 'desc' }}
        pageSize={12}
      />
    </Card>
  )
}
