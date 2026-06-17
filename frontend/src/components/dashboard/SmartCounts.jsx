import { useMemo } from 'react'
import { usePortfolio } from '../../context/PortfolioContext'
import { useAlerts } from '../../context/AlertsContext'
import { heldStocks, fullyExited, reentryOpportunities } from '../../analytics/opportunities'
import { Card } from '../common/ui'

function Tile({ label, value, hint, tone }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone || 'text-slate-900 dark:text-slate-100'}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>}
    </Card>
  )
}

/**
 * Smart dashboard summary tiles (F12): held / fully-exited counts, stocks below last
 * sell price, stocks in their re-entry zone, and an upcoming-alerts placeholder (P4).
 */
export default function SmartCounts() {
  const { journeys } = usePortfolio()
  const { alerts } = useAlerts()
  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE').length
  const { held, exited, reentry, inZone } = useMemo(() => {
    const j = journeys || []
    const re = reentryOpportunities(j)
    return {
      held: heldStocks(j).length,
      exited: fullyExited(j).length,
      reentry: re.length,
      inZone: re.filter((r) => r.inZone).length,
    }
  }, [journeys])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tile label="Currently Held" value={held} hint="stocks in your portfolio" />
      <Tile label="Fully Exited" value={exited} hint="completely sold out" />
      <Tile label="Below Last Sell" value={reentry} hint="trading under your exit" tone={reentry ? 'text-down' : undefined} />
      <Tile label="Near Re-Entry Zone" value={inZone} hint="within suggested band" tone={inZone ? 'text-up' : undefined} />
      <Tile label="Active Alerts" value={activeAlerts} hint="watching your prices" tone={activeAlerts ? 'text-indigo-500' : undefined} />
    </div>
  )
}
