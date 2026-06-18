import { useEffect, useMemo, useState } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { computeDrift, currentAsTargets } from '../analytics/rebalance'
import { Card, SectionTitle, EmptyState } from '../components/common/ui'
import { money } from '../analytics/format'

const KEY = 'stocker_targets'
const inr = (n) => money(n, 'INR')

const loadTargets = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

export default function Rebalance() {
  const { holdings } = usePortfolio()
  const [targets, setTargets] = useState(loadTargets)

  // Seed targets from the current allocation the first time (nothing saved yet).
  useEffect(() => {
    if (Object.keys(targets).length === 0 && holdings.length) {
      setTargets(currentAsTargets(holdings))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings.length])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(targets))
    } catch {
      /* ignore */
    }
  }, [targets])

  const { rows, totalToMove, targetSum, drifted, total } = useMemo(
    () => computeDrift(holdings, targets),
    [holdings, targets],
  )

  const setTarget = (sector, v) => setTargets((t) => ({ ...t, [sector]: v === '' ? 0 : Number(v) }))

  if (!holdings.length) {
    return (
      <div className="space-y-6">
        <SectionTitle title="Rebalancing" subtitle="Set target allocations and see what to trim or add" />
        <EmptyState icon="⚖️" title="No holdings to rebalance" message="Connect a broker or use demo mode to set targets." />
      </div>
    )
  }

  const sumOk = Math.abs(targetSum - 100) < 0.5

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Rebalancing Intelligence"
        subtitle="Drift vs your target sector allocation — with the trades to fix it"
      />

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Target allocation by sector</h3>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${sumOk ? 'text-up' : 'text-down'}`}>Total: {targetSum.toFixed(1)}%{!sumOk && ' (should be 100%)'}</span>
            <button
              onClick={() => setTargets(currentAsTargets(holdings))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30"
            >
              Use current as target
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <label key={r.sector} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
              <span className="truncate text-sm text-slate-700 dark:text-slate-300">{r.sector}</span>
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  step="any"
                  value={targets[r.sector] ?? 0}
                  onChange={(e) => setTarget(r.sector, e.target.value)}
                  className="w-16 rounded-md border border-slate-200 bg-transparent px-1.5 py-1 text-right text-sm dark:border-white/10"
                />
                <span className="text-xs text-slate-400">%</span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle
          title="Drift & Suggested Trades"
          subtitle={drifted.length ? `${drifted.length} sector(s) off target · ~${inr(totalToMove)} to rebalance` : 'On target'}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-white/10">
                <th className="py-2 pr-3">Sector</th>
                <th className="py-2 pr-3 text-right">Current</th>
                <th className="py-2 pr-3 text-right">Target</th>
                <th className="py-2 pr-3 text-right">Drift</th>
                <th className="py-2 pr-3 text-right">Value</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sector} className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">{r.sector}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.currentPct}%</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-400">{r.targetPct}%</td>
                  <td className={`py-2 pr-3 text-right tabular-nums ${r.driftPct > 0 ? 'text-down' : r.driftPct < 0 ? 'text-up' : 'text-slate-400'}`}>
                    {r.driftPct > 0 ? '+' : ''}{r.driftPct}%
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{inr(r.currentValue)}</td>
                  <td className="py-2 text-right">
                    {r.action === 'OK' ? (
                      <span className="text-xs text-slate-400">On target</span>
                    ) : (
                      <span className={`text-xs font-semibold ${r.action === 'TRIM' ? 'text-down' : 'text-up'}`}>
                        {r.action === 'TRIM' ? 'Trim' : 'Add'} {inr(r.amount)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Sector weights from current market value. Trim over-weight sectors and add to under-weight ones to reach your
          target. For tax-smart trims, check the Tax tab (avoid harvesting lots that are about to turn long-term).
        </p>
      </Card>
    </div>
  )
}
