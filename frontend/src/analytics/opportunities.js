// Pure selectors over the per-stock journeys (from analytics/ledger.js buildAllJourneys)
// and the raw ledger. These power the dashboard intelligence widgets (F7, F8, F12):
// re-entry opportunities, fully-exited stocks, last-sold reminders, top movers, recent activity.
import { reentryZone } from './ledger'

const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v))

// Difference of current price vs a reference (e.g. last sell), in %.
const diffPct = (current, ref) => (ref ? ((current - ref) / ref) * 100 : null)

export const heldStocks = (journeys = []) => journeys.filter((j) => j.status === 'HOLDING')

export const fullyExited = (journeys = []) => journeys.filter((j) => j.status === 'EXITED')

/**
 * Exited stocks now trading below the last exit price — "should I re-enter?" (F7/F8).
 * Returns enriched rows sorted by biggest opportunity (furthest below last sell) first.
 */
export function reentryOpportunities(journeys = []) {
  return fullyExited(journeys)
    .map((j) => {
      const last = num(j.lastPrice)
      const sell = num(j.lastSellPrice)
      if (last == null || sell == null) return null
      const dp = diffPct(last, sell)
      const zone = reentryZone(sell)
      return {
        symbol: j.symbol,
        name: j.name,
        securityId: j.securityId,
        lastSellPrice: sell,
        lastPrice: last,
        diffPct: dp, // negative => below your exit
        zone, // { low, high } suggested re-entry band
        inZone: zone ? last <= zone.high : false,
        belowLastSell: last < sell,
        realizedPnl: j.realizedPnl,
      }
    })
    .filter((r) => r && r.belowLastSell)
    .sort((a, b) => a.diffPct - b.diffPct) // most negative (biggest drop) first
}

/**
 * Last-sold reminder rows for ALL exited stocks (F7) — both below and above exit,
 * with a human status label. Sorted by furthest below exit first.
 */
export function lastSoldReminders(journeys = []) {
  return fullyExited(journeys)
    .map((j) => {
      const last = num(j.lastPrice)
      const sell = num(j.lastSellPrice)
      if (last == null || sell == null) return null
      const dp = diffPct(last, sell)
      return {
        symbol: j.symbol,
        name: j.name,
        securityId: j.securityId,
        lastSellPrice: sell,
        lastPrice: last,
        diffPct: dp,
        status: last < sell ? 'Below Your Last Exit Price' : 'Trading Above Your Exit Price',
        below: last < sell,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.diffPct - b.diffPct)
}

// Lifetime winners (total P&L = realized + unrealized) — positive only, biggest first.
export function topProfit(journeys = [], n = 5) {
  return [...journeys]
    .filter((j) => num(j.totalPnl) != null && j.totalPnl > 0)
    .sort((a, b) => b.totalPnl - a.totalPnl)
    .slice(0, n)
}

// Lifetime losers — negative only, worst first.
export function topLoss(journeys = [], n = 5) {
  return [...journeys]
    .filter((j) => num(j.totalPnl) != null && j.totalPnl < 0)
    .sort((a, b) => a.totalPnl - b.totalPnl)
    .slice(0, n)
}

// Most recent transactions across the whole ledger (F12).
export function recentTransactions(transactions = [], n = 8) {
  return [...transactions]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt || '') < (b.createdAt || '') ? 1 : -1))
    .slice(0, n)
}

/**
 * Realized-P&L rollup across all journeys (powers the RealizedProfit widget).
 * Counts stocks that have at least one sell (timesSold > 0).
 */
export function realizedSummary(journeys = []) {
  const closed = journeys.filter((j) => j.timesSold > 0)
  let gains = 0
  let losses = 0
  let wins = 0
  let durationSum = 0
  let durationCount = 0
  for (const j of closed) {
    const r = num(j.realizedPnl) || 0
    if (r >= 0) {
      gains += r
      wins += 1
    } else {
      losses += r
    }
    if (j.holdingDays != null) {
      durationSum += j.holdingDays
      durationCount += 1
    }
  }
  return {
    closedCount: closed.length,
    totalRealizedGains: gains,
    totalRealizedLosses: losses, // negative
    netRealized: gains + losses,
    winRate: closed.length ? (wins / closed.length) * 100 : null,
    avgHoldingDays: durationCount ? Math.round(durationSum / durationCount) : null,
  }
}
