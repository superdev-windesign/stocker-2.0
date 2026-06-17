// Scheduled jobs (node-cron). DEPLOY-ONLY: runs only when ENABLE_SCHEDULER=true, so it
// never starts in the dev sandbox (which can't reach Paytm anyway). Two jobs:
//   1. market-hours poll -> fetch quotes for symbols with active alerts -> evaluate -> notify
//   2. end-of-day -> write a portfolio NAV snapshot
// Locally, the alert path is exercised via POST /api/alerts/evaluate-now instead.
import cron from 'node-cron'
import { listAlerts, evaluateAlerts } from './alerts.js'
import { notify } from './notifications.js'
import * as priceProvider from './providers/priceProvider.paytm.js'
import { writeSnapshot } from './nav.js'
import { paytmGet } from './paytm.js'

const num = (...v) => {
  for (const x of v) {
    if (x == null || x === '') continue
    const n = Number(x)
    if (!Number.isNaN(n)) return n
  }
  return null
}

// Sum invested / current value from raw Paytm holdings (server-side, no FIFO needed).
async function portfolioTotals() {
  const resp = await paytmGet('/holdings/v1/get-user-holdings-data')
  const rows =
    resp?.data?.results || resp?.results || resp?.data || (Array.isArray(resp) ? resp : []) || []
  let invested = 0
  let currentValue = 0
  for (const h of rows) {
    const qty = num(h.quantity, h.qty, h.total_qty) ?? 0
    const avg = num(h.cost_price, h.avg_price, h.average_price) ?? 0
    const ltp = num(h.last_traded_price, h.ltp, h.last_price, h.close_price) ?? 0
    invested += qty * avg
    currentValue += qty * ltp
  }
  return { invested, currentValue, holdingsCount: rows.length }
}

export async function runAlertPoll() {
  const active = (await listAlerts()).filter((a) => a.status === 'ACTIVE')
  if (!active.length) return { fired: 0 }

  const withSymbol = active.filter((a) => a.symbol && a.securityId)
  const items = [...new Map(withSymbol.map((a) => [a.symbol, { symbol: a.symbol, securityId: a.securityId, exchange: a.exchange }])).values()]
  const priceMap = items.length ? await priceProvider.getQuotes(items) : {}

  // Portfolio-level context only needed if a PORTFOLIO_PNL_PCT alert exists.
  let ctx = {}
  if (active.some((a) => a.type === 'PORTFOLIO_PNL_PCT')) {
    try {
      const t = await portfolioTotals()
      ctx.portfolioPnlPct = t.invested ? ((t.currentValue - t.invested) / t.invested) * 100 : null
    } catch {
      /* ignore */
    }
  }

  const fired = await evaluateAlerts(priceMap, ctx)
  for (const f of fired) {
    await notify(f.alert.channels, {
      title: f.title,
      body: f.body,
      symbol: f.alert.symbol,
      alertId: f.alert.id,
      kind: 'ALERT',
    })
  }
  return { fired: fired.length }
}

export async function runEodSnapshot() {
  try {
    const t = await portfolioTotals()
    await writeSnapshot(new Date().toISOString().slice(0, 10), {
      invested: t.invested,
      currentValue: t.currentValue,
      realizedPnl: null,
      unrealizedPnl: t.currentValue - t.invested,
      holdingsCount: t.holdingsCount,
    })
  } catch (err) {
    console.error('[stocker] EOD snapshot failed:', err.message)
  }
}

export function startScheduler() {
  if (process.env.ENABLE_SCHEDULER !== 'true') return
  // Cron runs in the server's timezone. These are broad windows; the jobs no-op when
  // there's nothing to do, so exact market-hours gating isn't critical.
  cron.schedule('*/5 * * * 1-5', () => runAlertPoll().catch((e) => console.error('[stocker] poll error:', e.message)))
  cron.schedule('0 12 * * 1-5', () => runEodSnapshot()) // ~end of IST trading day (UTC ~12:00)
  console.log('[stocker] scheduler enabled (alert poll + EOD snapshot)')
}
