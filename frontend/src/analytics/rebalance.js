// Portfolio rebalancing — drift detection against user-set target sector allocations,
// with the rupee amounts to trim/add to get back on target. Pure + local (targets live
// in localStorage). Cross-currency portfolios are summed on currentValue (approximate).
import { allocationBy } from './portfolioMetrics'

const round = (n) => Math.round(n * 100) / 100

/**
 * @param {Array} holdings
 * @param {Object} targets  { [sector]: targetPct }  (percentages, ideally summing to 100)
 * @returns {{ total, rows, totalToMove, targetSum, drifted }}
 */
export function computeDrift(holdings = [], targets = {}) {
  const alloc = allocationBy(holdings, 'sector') // [{ name, value, pct }]
  const total = alloc.reduce((a, s) => a + s.value, 0)
  const currentBy = Object.fromEntries(alloc.map((s) => [s.name, s]))

  // Union of sectors you hold + sectors you've set a target for.
  const names = [...new Set([...alloc.map((s) => s.name), ...Object.keys(targets)])]

  const rows = names
    .map((name) => {
      const cur = currentBy[name] || { value: 0, pct: 0 }
      const targetPct = Number(targets[name] ?? 0)
      const driftPct = cur.pct - targetPct
      const targetValue = (targetPct / 100) * total
      const deltaValue = targetValue - cur.value // +ve = add, -ve = trim
      const action = Math.abs(driftPct) < 1 ? 'OK' : deltaValue > 0 ? 'ADD' : 'TRIM'
      return {
        sector: name,
        currentValue: cur.value,
        currentPct: round(cur.pct),
        targetPct: round(targetPct),
        driftPct: round(driftPct),
        amount: round(Math.abs(deltaValue)),
        action,
      }
    })
    .sort((a, b) => Math.abs(b.driftPct) - Math.abs(a.driftPct))

  const totalToMove = round(rows.filter((r) => r.action === 'TRIM').reduce((a, r) => a + r.amount, 0))
  const targetSum = round(Object.values(targets).reduce((a, v) => a + Number(v || 0), 0))
  const drifted = rows.filter((r) => r.action !== 'OK')
  return { total, rows, totalToMove, targetSum, drifted }
}

// A reasonable starting target: the current allocation (so the user can tweak from there).
export function currentAsTargets(holdings = []) {
  return Object.fromEntries(allocationBy(holdings, 'sector').map((s) => [s.name, round(s.pct)]))
}
