// Scheduled jobs (node-cron). DEPLOY-ONLY — runs when ENABLE_SCHEDULER=true.
// Multi-user: iterates all registered users, running alerts + NAV snapshot per-user.
import cron from 'node-cron'
import { db } from './paytm.js'
import { listAlerts, evaluateAlerts } from './alerts.js'
import { notify } from './notifications.js'
import * as priceProvider from './providers/priceProvider.paytm.js'
import { writeSnapshot } from './nav.js'
import { paytmGet } from './paytm.js'

// All registered user IDs (used to fan jobs out per-user).
async function allUserIds() {
  const res = await db.execute(`SELECT id FROM users`)
  return res.rows.map((r) => r.id)
}

const num = (...v) => {
  for (const x of v) {
    if (x == null || x === '') continue
    const n = Number(x)
    if (!Number.isNaN(n)) return n
  }
  return null
}

async function portfolioTotals(userId) {
  const resp = await paytmGet('/holdings/v1/get-user-holdings-data', {}, userId)
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

export async function runAlertPoll(userId) {
  const active = (await listAlerts(userId)).filter((a) => a.status === 'ACTIVE')
  if (!active.length) return { fired: 0 }

  const withSymbol = active.filter((a) => a.symbol && a.securityId)
  const items = [
    ...new Map(
      withSymbol.map((a) => [a.symbol, { symbol: a.symbol, securityId: a.securityId, exchange: a.exchange }]),
    ).values(),
  ]
  const priceMap = items.length ? await priceProvider.getQuotes(items) : {}

  let ctx = {}
  if (active.some((a) => a.type === 'PORTFOLIO_PNL_PCT')) {
    try {
      const t = await portfolioTotals(userId)
      ctx.portfolioPnlPct = t.invested ? ((t.currentValue - t.invested) / t.invested) * 100 : null
    } catch { /* ignore — user may not have Paytm connected */ }
  }

  const fired = await evaluateAlerts(userId, priceMap, ctx)
  for (const f of fired) {
    await notify(userId, f.alert.channels, {
      title: f.title,
      body: f.body,
      symbol: f.alert.symbol,
      alertId: f.alert.id,
      kind: 'ALERT',
    })
  }
  return { fired: fired.length }
}

export async function runEodSnapshot(userId) {
  try {
    const t = await portfolioTotals(userId)
    await writeSnapshot(userId, new Date().toISOString().slice(0, 10), {
      invested: t.invested,
      currentValue: t.currentValue,
      realizedPnl: null,
      unrealizedPnl: t.currentValue - t.invested,
      holdingsCount: t.holdingsCount,
    })
  } catch (err) {
    console.error(`[stocker] EOD snapshot failed for user ${userId}:`, err.message)
  }
}

// Fan out a job to all users, collecting errors without stopping.
async function fanOut(jobFn, label) {
  const ids = await allUserIds()
  for (const uid of ids) {
    try {
      await jobFn(uid)
    } catch (err) {
      console.error(`[stocker] ${label} failed for user ${uid}:`, err.message)
    }
  }
}

export function startScheduler() {
  if (process.env.ENABLE_SCHEDULER !== 'true') return
  cron.schedule('*/5 * * * 1-5', () => fanOut(runAlertPoll, 'alert-poll').catch((e) => console.error('[stocker] poll error:', e.message)))
  cron.schedule('0 12 * * 1-5', () => fanOut(runEodSnapshot, 'eod-snapshot'))
  console.log('[stocker] scheduler enabled (alert poll + EOD snapshot — multi-user)')
}
