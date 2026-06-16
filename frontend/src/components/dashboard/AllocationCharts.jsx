import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, SectionTitle } from '../common/ui'
import { allocationBy, topHoldings, diversificationScore } from '../../analytics/portfolioMetrics'
import { sectorColor } from '../../data/sectors'
import { inrCompact, inr } from '../../analytics/format'

const CAP_COLORS = { Large: '#6366f1', Mid: '#06b6d4', Small: '#f59e0b', Unknown: '#64748b' }

function AllocPie({ title, data, colorFn }) {
  return (
    <Card className="p-4">
      <SectionTitle title={title} />
      <div className="flex items-center gap-3">
        <ResponsiveContainer width="55%" height={180}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {data.map((d) => (
                <Cell key={d.name} fill={colorFn(d.name)} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, n) => [`₹${inr(v)}`, n]}
              contentStyle={{ background: '#12161c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#eaecef' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex-1 space-y-1.5 text-sm">
          {data.slice(0, 6).map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 truncate">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorFn(d.name) }} />
                <span className="truncate text-slate-600 dark:text-slate-300">{d.name}</span>
              </span>
              <span className="tabular-nums text-slate-500">{d.pct.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

export default function AllocationCharts({ holdings }) {
  const bySector = allocationBy(holdings, 'sector')
  const byCap = allocationBy(holdings, 'cap')
  const top = topHoldings(holdings, 5)
  const divScore = diversificationScore(holdings)

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      <AllocPie title="Sector Allocation" data={bySector} colorFn={sectorColor} />
      <AllocPie title="Market Cap" data={byCap} colorFn={(n) => CAP_COLORS[n] || '#64748b'} />

      <Card className="p-4">
        <SectionTitle title="Top Holdings" />
        <ul className="space-y-2">
          {top.map((h) => (
            <li key={h.securityId || h.symbol}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">{h.symbol}</span>
                <span className="tabular-nums text-slate-500">{h.allocationPct.toFixed(1)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, h.allocationPct)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col items-center justify-center p-4 text-center">
        <SectionTitle title="Diversification" />
        <div className="relative my-2 grid h-28 w-28 place-items-center">
          <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-white/10" />
            <circle
              cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${divScore} 100`}
            />
          </svg>
          <div className="absolute text-2xl font-bold text-slate-900 dark:text-slate-100">{divScore}</div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {divScore >= 70 ? 'Well diversified' : divScore >= 40 ? 'Moderately diversified' : 'Concentrated'}
        </p>
      </Card>
    </div>
  )
}
