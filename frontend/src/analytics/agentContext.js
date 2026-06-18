// Compact portfolio snapshot for the agentic Copilot — reuses the insight payload plus
// tax + rebalance summaries, so the agent reasons over the same numbers the UI shows.
import { buildInsightPayload } from './insightsPayload'
import { taxSummary } from './tax'
import { computeDrift } from './rebalance'

const r2 = (n) => (n == null || Number.isNaN(Number(n)) ? null : Math.round(Number(n) * 100) / 100)

export function buildAgentContext({ holdings = [], journeys = [], transactions = [] }, targets = {}) {
  const base = buildInsightPayload({ holdings, journeys, transactions })
  const tax = taxSummary(journeys)
  const drift = computeDrift(holdings, targets)
  return {
    ...base,
    tax: {
      stGain: r2(tax.realized.stGain),
      ltGain: r2(tax.realized.ltGain),
      totalTaxDue: r2(tax.realized.totalTax),
      harvestableLoss: r2(tax.harvestableLoss),
      estHarvestSaving: r2(tax.estSaving),
      ltReadiness: tax.ltReadiness.slice(0, 3).map((x) => ({ symbol: x.symbol, daysToLT: x.daysToLT, saving: r2(x.potentialSaving) })),
    },
    rebalance: {
      targetSet: Object.keys(targets).length > 0,
      drifted: drift.drifted.slice(0, 6).map((d) => ({ sector: d.sector, currentPct: d.currentPct, targetPct: d.targetPct, action: d.action, amount: d.amount })),
    },
  }
}
