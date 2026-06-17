import { useMemo } from 'react'
import { usePortfolio } from '../../context/PortfolioContext'
import { splitByCountry } from '../../analytics/portfolioMetrics'
import { Card, SectionTitle } from '../common/ui'
import { money } from '../../analytics/format'

const FLAG = { IN: '🇮🇳', US: '🇺🇸' }
const LABEL = { IN: 'India', US: 'United States' }

// India vs US allocation, each shown in its own currency (no cross-currency sum). Only
// renders when the portfolio actually spans more than one country.
export default function CountrySplit() {
  const { holdings } = usePortfolio()
  const rows = useMemo(() => splitByCountry(holdings), [holdings])
  if (rows.length < 2) return null

  return (
    <Card className="p-4">
      <SectionTitle title="By Country" subtitle="Holdings across markets (each in its own currency)" />
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => {
          const pnl = r.currentValue - r.invested
          return (
            <div key={r.country} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {FLAG[r.country] || '🌐'} {LABEL[r.country] || r.country}
                </span>
                <span className="text-xs text-slate-400">{r.count} {r.count === 1 ? 'stock' : 'stocks'}</span>
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {money(r.currentValue, r.currency)}
              </div>
              <div className={`text-xs tabular-nums ${pnl >= 0 ? 'text-up' : 'text-down'}`}>
                {money(pnl, r.currency)} P&L · invested {money(r.invested, r.currency)}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
