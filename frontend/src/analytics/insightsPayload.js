// Builds the COMPACT metrics payload the AI analyst consumes. Deliberately small and
// pre-computed (no raw holdings/ledger) to keep LLM token usage + cost low. Reuses the
// existing analytics so the AI sees exactly what the dashboard shows.
import { summarize, allocationBy, diversificationScore } from './portfolioMetrics'
import { topProfit, topLoss, reentryOpportunities, realizedSummary, recentTransactions } from './opportunities'

const r2 = (n) => (n == null || Number.isNaN(Number(n)) ? null : Math.round(Number(n) * 100) / 100)

export function buildInsightPayload({ holdings = [], journeys = [], transactions = [] }) {
  const s = summarize(holdings)
  const sectors = allocationBy(holdings, 'sector')
  const realized = realizedSummary(journeys)
  const timesBoughtTop = [...journeys]
    .sort((a, b) => b.timesBought - a.timesBought)
    .slice(0, 2)
    .map((j) => ({ symbol: j.symbol, timesBought: j.timesBought, timesSold: j.timesSold }))

  return {
    asOf: new Date().toISOString().slice(0, 10),
    currency: 'INR',
    totals: {
      invested: r2(s.totalInvested),
      currentValue: r2(s.currentValue),
      totalPnl: r2(s.totalPnl),
      totalPnlPct: r2(s.totalPnlPct),
      dayChangeAbs: r2(s.dayChangeAbs),
      dayChangePct: r2(s.dayChangePct),
      holdingsCount: s.holdingsCount,
    },
    best: s.best ? { symbol: s.best.symbol, pnlPct: r2(s.best.pnlPct) } : null,
    worst: s.worst ? { symbol: s.worst.symbol, pnlPct: r2(s.worst.pnlPct) } : null,
    topProfit: topProfit(journeys, 3).map((j) => ({ symbol: j.symbol, totalPnl: r2(j.totalPnl), totalReturnPct: r2(j.totalReturnPct) })),
    topLoss: topLoss(journeys, 3).map((j) => ({ symbol: j.symbol, totalPnl: r2(j.totalPnl), totalReturnPct: r2(j.totalReturnPct) })),
    realized: { netRealized: r2(realized.netRealized), winRate: r2(realized.winRate), closedCount: realized.closedCount },
    diversification: {
      score: diversificationScore(holdings),
      topSector: sectors[0] ? { name: sectors[0].name, pct: r2(sectors[0].pct) } : null,
    },
    sectors: sectors.slice(0, 5).map((x) => ({ name: x.name, pct: r2(x.pct) })),
    reentry: reentryOpportunities(journeys)
      .slice(0, 3)
      .map((r) => ({ symbol: r.symbol, lastSellPrice: r2(r.lastSellPrice), lastPrice: r2(r.lastPrice), diffPct: r2(r.diffPct) })),
    activity: {
      timesBoughtTop,
      recent: recentTransactions(transactions, 5).map((t) => ({ symbol: t.symbol, type: t.type, date: t.date })),
    },
  }
}
