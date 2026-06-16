// Aggregate analytics computed from normalized holdings.
import { sectorColor } from '../data/sectors'

export function summarize(holdings) {
  const totalInvested = sum(holdings, 'invested')
  const currentValue = sum(holdings, 'currentValue')
  const totalPnl = currentValue - totalInvested
  const totalPnlPct = totalInvested ? (totalPnl / totalInvested) * 100 : null

  const dayChangeAbs = holdings.reduce((a, h) => a + (h.dayChangeAbs || 0), 0)
  const prevValue = currentValue - dayChangeAbs
  const dayChangePct = prevValue ? (dayChangeAbs / prevValue) * 100 : null

  const ranked = [...holdings].filter((h) => h.pnlPct != null).sort((a, b) => b.pnlPct - a.pnlPct)
  const best = ranked[0] || null
  const worst = ranked[ranked.length - 1] || null

  return {
    totalInvested,
    currentValue,
    totalPnl,
    totalPnlPct,
    dayChangeAbs,
    dayChangePct,
    holdingsCount: holdings.length,
    best,
    worst,
    // Realized gains require lifetime trade history (not available via API).
    realizedGains: null,
    unrealizedGains: totalPnl,
  }
}

export function allocationBy(holdings, key) {
  const total = sum(holdings, 'currentValue')
  const groups = {}
  for (const h of holdings) {
    const g = h[key] || 'Other'
    groups[g] = (groups[g] || 0) + h.currentValue
  }
  return Object.entries(groups)
    .map(([name, value]) => ({
      name,
      value,
      pct: total ? (value / total) * 100 : 0,
      color: key === 'sector' ? sectorColor(name) : undefined,
    }))
    .sort((a, b) => b.value - a.value)
}

export function topHoldings(holdings, n = 5) {
  const total = sum(holdings, 'currentValue')
  return [...holdings]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, n)
    .map((h) => ({ ...h, allocationPct: total ? (h.currentValue / total) * 100 : 0 }))
}

export function allocationPct(holdings) {
  const total = sum(holdings, 'currentValue')
  return holdings.map((h) => ({
    ...h,
    allocationPct: total ? (h.currentValue / total) * 100 : 0,
  }))
}

// Diversification score 0-100 from the Herfindahl-Hirschman Index of value weights.
// 1 holding -> low score; many evenly-weighted holdings -> high score.
export function diversificationScore(holdings) {
  const total = sum(holdings, 'currentValue')
  if (!total || holdings.length === 0) return 0
  const hhi = holdings.reduce((a, h) => {
    const w = h.currentValue / total
    return a + w * w
  }, 0)
  const n = holdings.length
  if (n === 1) return 0
  // Normalize HHI against the most-concentrated (1) and perfectly-even (1/n) cases.
  const normalized = (1 - hhi) / (1 - 1 / n)
  return Math.round(Math.max(0, Math.min(1, normalized)) * 100)
}

function sum(arr, key) {
  return arr.reduce((a, x) => a + (x[key] || 0), 0)
}
