import { Card, SectionTitle } from '../common/ui'
import { inr, pct, signClass } from '../../analytics/format'

function Tile({ label, value, accent, sub }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-white/10">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 font-semibold tabular-nums ${accent || 'text-slate-800 dark:text-slate-200'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

export default function PerformanceMetrics({ holding, stats }) {
  const diffPct = holding.avgPrice ? ((holding.lastPrice - holding.avgPrice) / holding.avgPrice) * 100 : null
  return (
    <Card className="p-4">
      <SectionTitle title="Performance Analysis" subtitle="Computed from real historical price candles" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Current Price" value={`₹${inr(holding.lastPrice)}`} />
        <Tile label="Avg Buy Price" value={`₹${inr(holding.avgPrice)}`} />
        <Tile label="Difference" value={pct(diffPct)} accent={signClass(diffPct)} />
        <Tile label="CAGR" value={pct(stats?.cagr)} accent={signClass(stats?.cagr)} sub="annualized" />
        <Tile label="Total Return (range)" value={pct(stats?.totalReturn)} accent={signClass(stats?.totalReturn)} />
        <Tile label="Volatility" value={stats?.volatility != null ? `${stats.volatility.toFixed(1)}%` : '—'} sub="annualized" />
        <Tile label="Max Drawdown" value={pct(stats?.maxDrawdown)} accent="text-down" />
        <Tile label="Highest Profit Reached" value={stats?.athAtl ? `₹${inr((stats.athAtl.ath - holding.avgPrice) * holding.quantity)}` : '—'} accent="text-up" sub="if sold at ATH" />
        <Tile label="Annualized Return" value={pct(stats?.cagr)} accent={signClass(stats?.cagr)} />
      </div>
    </Card>
  )
}
