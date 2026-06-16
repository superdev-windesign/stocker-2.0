import { useMemo } from 'react'
import { Card, SectionTitle } from '../common/ui'
import { inr, pct, signClass } from '../../analytics/format'

function StatTile({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-white/10">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 font-semibold ${accent || 'text-slate-800 dark:text-slate-200'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export default function AdvancedAnalytics({ holdings }) {
  const a = useMemo(() => analyze(holdings), [holdings])
  if (!holdings.length) return null

  return (
    <Card className="p-4">
      <SectionTitle title="Advanced Analytics" subtitle="Derived from current holdings + today's prices" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Most Profitable" value={a.mostProfit?.symbol || '—'} sub={a.mostProfit && `₹${inr(a.mostProfit.pnl)}`} accent="text-up" />
        <StatTile label="Largest Loser" value={a.largestLoss?.symbol || '—'} sub={a.largestLoss && `₹${inr(a.largestLoss.pnl)}`} accent="text-down" />
        <StatTile label="Top Day Gain" value={a.dayGain?.symbol || '—'} sub={a.dayGain && pct(a.dayGain.dayChangePct)} accent="text-up" />
        <StatTile label="Top Day Loss" value={a.dayLoss?.symbol || '—'} sub={a.dayLoss && pct(a.dayLoss.dayChangePct)} accent="text-down" />
        <StatTile label="Biggest Position" value={a.biggest?.symbol || '—'} sub={a.biggest && `₹${inr(a.biggest.currentValue)}`} />
        <StatTile label="Best Sector" value={a.bestSector?.name || '—'} sub={a.bestSector && pct(a.bestSector.pnlPct)} accent="text-up" />
        <StatTile label="Worst Sector" value={a.worstSector?.name || '—'} sub={a.worstSector && pct(a.worstSector.pnlPct)} accent="text-down" />
        <StatTile label="Most Traded" value="—" sub="needs history" />
      </div>

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">💡 Insights</h3>
        <ul className="space-y-1.5">
          {a.insights.map((t, i) => (
            <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-300">
              {t}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function analyze(holdings) {
  if (!holdings.length) return { insights: [] }
  const byPnl = [...holdings].sort((x, y) => y.pnl - x.pnl)
  const byDay = holdings.filter((h) => h.dayChangePct != null).sort((x, y) => y.dayChangePct - x.dayChangePct)
  const byValue = [...holdings].sort((x, y) => y.currentValue - x.currentValue)

  // Sector aggregates.
  const sectors = {}
  let totalValue = 0
  let totalPnl = 0
  for (const h of holdings) {
    totalValue += h.currentValue
    totalPnl += h.pnl
    const s = (sectors[h.sector] = sectors[h.sector] || { name: h.sector, invested: 0, value: 0, pnl: 0 })
    s.invested += h.invested
    s.value += h.currentValue
    s.pnl += h.pnl
  }
  const sectorArr = Object.values(sectors).map((s) => ({ ...s, pnlPct: s.invested ? (s.pnl / s.invested) * 100 : 0 }))
  const bestSector = [...sectorArr].sort((x, y) => y.pnlPct - x.pnlPct)[0]
  const worstSector = [...sectorArr].sort((x, y) => x.pnlPct - y.pnlPct)[0]
  const topSectorByValue = [...sectorArr].sort((x, y) => y.value - x.value)[0]

  const winners = holdings.filter((h) => h.pnl > 0).length
  const profitContributors = sectorArr.filter((s) => s.pnl > 0).sort((x, y) => y.pnl - x.pnl)[0]

  const insights = []
  if (topSectorByValue && totalValue)
    insights.push(`${topSectorByValue.name} makes up ${((topSectorByValue.value / totalValue) * 100).toFixed(0)}% of your portfolio value.`)
  if (profitContributors && totalPnl > 0)
    insights.push(`${profitContributors.name} stocks contributed ${((profitContributors.pnl / totalPnl) * 100).toFixed(0)}% of your total gains.`)
  insights.push(`${winners} of ${holdings.length} holdings are currently in profit.`)
  if (byPnl[0]?.pnl > 0)
    insights.push(`${byPnl[0].symbol} is your biggest winner at ₹${inr(byPnl[0].pnl)} (${pct(byPnl[0].pnlPct)}).`)

  return {
    mostProfit: byPnl[0]?.pnl > 0 ? byPnl[0] : null,
    largestLoss: byPnl[byPnl.length - 1]?.pnl < 0 ? byPnl[byPnl.length - 1] : null,
    dayGain: byDay[0]?.dayChangePct > 0 ? byDay[0] : null,
    dayLoss: byDay[byDay.length - 1]?.dayChangePct < 0 ? byDay[byDay.length - 1] : null,
    biggest: byValue[0],
    bestSector,
    worstSector,
    insights,
  }
}
