import { useMemo } from 'react'
import { usePortfolio } from '../../context/PortfolioContext'
import { allocationBy, diversificationScore, topHoldings } from '../../analytics/portfolioMetrics'
import { Card, SectionTitle } from '../common/ui'

// Tone by threshold: green (ok) / amber (watch) / red (flag).
const tone = (v, amber, red) => (v >= red ? 'text-down' : v >= amber ? 'text-amber-500' : 'text-up')
const pct1 = (n) => `${n.toFixed(1)}%`

function Tile({ label, value, tone: t, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${t || 'text-slate-900 dark:text-slate-100'}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
  )
}

/**
 * Portfolio-level concentration risk (computable from holdings, no extra data):
 * top-3 weight, largest sector, diversification score. Flags >50% top-3 / >40% sector.
 */
export default function RiskDashboard() {
  const { holdings } = usePortfolio()
  const risk = useMemo(() => {
    const total = holdings.reduce((a, h) => a + (h.currentValue || 0), 0)
    if (!total) return null
    const top3 = topHoldings(holdings, 3).reduce((a, h) => a + h.currentValue, 0)
    const top3Pct = (top3 / total) * 100
    const sectors = allocationBy(holdings, 'sector')
    const topSector = sectors[0] || { name: '—', pct: 0 }
    const div = diversificationScore(holdings)
    return { top3Pct, topSector, div, topName: topHoldings(holdings, 1)[0]?.symbol }
  }, [holdings])

  if (!risk) return null

  const verdict =
    risk.top3Pct > 50 || risk.topSector.pct > 40
      ? `Concentrated — ${risk.top3Pct > 50 ? 'top 3 holdings exceed 50%' : `${risk.topSector.name} is over 40%`}. Consider diversifying.`
      : risk.div >= 60
        ? 'Reasonably diversified across holdings and sectors.'
        : 'Moderately concentrated — watch your largest positions.'

  return (
    <Card className="p-4">
      <SectionTitle title="Risk & Concentration" subtitle="Portfolio-level exposure checks" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="Top 3 Holdings"
          value={pct1(risk.top3Pct)}
          tone={tone(risk.top3Pct, 35, 50)}
          hint={risk.top3Pct > 50 ? '⚠ over 50%' : 'of portfolio'}
        />
        <Tile
          label="Largest Sector"
          value={pct1(risk.topSector.pct)}
          tone={tone(risk.topSector.pct, 30, 40)}
          hint={risk.topSector.name}
        />
        <Tile
          label="Diversification"
          value={`${risk.div}/100`}
          tone={risk.div >= 60 ? 'text-up' : risk.div >= 35 ? 'text-amber-500' : 'text-down'}
          hint="HHI-based"
        />
        <Tile label="Holdings" value={holdings.length} hint="positions" />
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{verdict}</p>
    </Card>
  )
}
