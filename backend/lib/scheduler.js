// Background workers — Phase 4: BullMQ on Redis.
// All workers run in-process (same Render instance as Express).
// Falls back to node-cron in-process if REDIS_URL is not set (local dev without Redis).
import { Queue, Worker } from 'bullmq'
import cron from 'node-cron'
import { db } from './paytm.js'
import { listAlerts, evaluateAlerts } from './alerts.js'
import { notify } from './notifications.js'
import * as priceProvider from './providers/priceProvider.paytm.js'
import { getDerivedHoldings } from './holdings.js'
import { writeSnapshot } from './nav.js'
import { generateInsight } from './insights.js'
import * as yahoo from './marketdata/yahoo.js'
import * as av from './marketdata/alphavantage.js'
import { syncAllHeldSymbols } from './corporateActions.js'
import { newRedisConnection } from './redis.js'

async function allUserIds() {
  const res = await db.execute(`SELECT id FROM users`)
  return res.rows.map((r) => r.id)
}

// ── Per-user jobs ─────────────────────────────────────────────────────────────

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
      const holdings = await getDerivedHoldings(userId)
      const invested = holdings.reduce((s, h) => s + (h.invested ?? 0), 0)
      const current  = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0)
      ctx.portfolioPnlPct = invested ? ((current - invested) / invested) * 100 : null
    } catch { /* ignore */ }
  }

  const fired = await evaluateAlerts(userId, priceMap, ctx)
  for (const f of fired) {
    await notify(userId, f.alert.channels, {
      title: f.title, body: f.body, symbol: f.alert.symbol, alertId: f.alert.id, kind: 'ALERT',
    })
  }
  return { fired: fired.length }
}

// Uses getDerivedHoldings (ledger-based) so CSV-only users also get NAV tracked.
export async function runEodSnapshot(userId) {
  try {
    const holdings = await getDerivedHoldings(userId)
    const invested  = holdings.reduce((s, h) => s + (h.invested    ?? 0), 0)
    const current   = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0)
    await writeSnapshot(userId, new Date().toISOString().slice(0, 10), {
      invested,
      currentValue:  current,
      realizedPnl:   null,
      unrealizedPnl: current - invested,
      holdingsCount: holdings.length,
    })
  } catch (err) {
    console.error(`[stocker] EOD snapshot failed for user ${userId}:`, err.message)
  }
}

export async function runDailyAi(userId) {
  try {
    const holdings = await getDerivedHoldings(userId)
    if (!holdings.length) return
    const invested = holdings.reduce((s, h) => s + (h.invested ?? 0), 0)
    const current  = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0)
    const pnlPct   = invested ? ((current - invested) / invested) * 100 : 0
    const currency = holdings.find((h) => h.currency)?.currency || 'INR'
    const metrics  = {
      totals: { invested, currentValue: current, unrealizedPnl: current - invested, pnlPct },
      currency,
      topHoldings: holdings
        .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
        .slice(0, 5)
        .map((h) => ({ symbol: h.symbol, name: h.name, pnlPct: h.pnlPct ?? 0, weight: invested ? (h.invested / invested) * 100 : 0 })),
    }
    await generateInsight(userId, metrics, 'DAILY')
  } catch (err) {
    console.error(`[stocker] daily-ai failed for user ${userId}:`, err.message)
  }
}

// Warms market data into Redis cache so first-user request is instant.
export async function runMarketRefresh() {
  try { await yahoo.indices() } catch (err) { console.warn('[stocker] market-refresh indices:', err.message) }
  if (av.isConfigured()) {
    try { await av.movers() } catch (err) { console.warn('[stocker] market-refresh movers:', err.message) }
  }
}

// Fan a per-user job out across all registered users.
async function fanOut(jobFn, label) {
  const ids = await allUserIds()
  for (const uid of ids) {
    try { await jobFn(uid) }
    catch (err) { console.error(`[stocker] ${label} failed for user ${uid}:`, err.message) }
  }
}

// ── BullMQ setup ──────────────────────────────────────────────────────────────

const QUEUES = {
  'alert-poll':       { cron: '*/5 * * * 1-5',  handler: () => fanOut(runAlertPoll,   'alert-poll') },
  'eod-nav':          { cron: '30 15 * * 1-5',   handler: () => fanOut(runEodSnapshot, 'eod-nav')   },
  'daily-ai':         { cron: '0 20 * * 1-5',    handler: () => fanOut(runDailyAi,     'daily-ai')  },
  'market-refresh':   { cron: '*/3 * * * *',     handler: runMarketRefresh                           },
  'corp-action-sync': { cron: '0 1 * * *',       handler: syncAllHeldSymbols                         },
}

function startBullMQ() {
  for (const [name, cfg] of Object.entries(QUEUES)) {
    const conn = newRedisConnection()
    if (!conn) return  // Redis not available

    const queue = new Queue(name, { connection: conn })

    // Register the repeatable job (idempotent — BullMQ deduplicates by pattern).
    queue.add(name, {}, { repeat: { pattern: cfg.cron }, removeOnComplete: 50, removeOnFail: 20 })
      .catch((err) => console.error(`[bullmq] schedule ${name} failed:`, err.message))

    const workerConn = newRedisConnection()
    const worker = new Worker(name, async () => {
      try { await cfg.handler() }
      catch (err) { console.error(`[bullmq] ${name} job error:`, err.message) }
    }, { connection: workerConn, concurrency: 1 })

    worker.on('completed', (job) => console.log(`[bullmq] ${name} #${job.id} done`))
    worker.on('failed',    (job, err) => console.error(`[bullmq] ${name} #${job?.id} failed:`, err.message))
    console.log(`[bullmq] worker registered: ${name} (${cfg.cron})`)
  }
}

// ── Fallback: node-cron (used locally when REDIS_URL is absent) ───────────────

function startCron() {
  cron.schedule('*/5 * * * 1-5', () => fanOut(runAlertPoll,   'alert-poll').catch(console.error))
  cron.schedule('30 15 * * 1-5', () => fanOut(runEodSnapshot, 'eod-nav').catch(console.error))
  cron.schedule('0 20 * * 1-5',  () => fanOut(runDailyAi,     'daily-ai').catch(console.error))
  cron.schedule('*/3 * * * *',   () => runMarketRefresh().catch(console.error))
  cron.schedule('0 1 * * *',     () => syncAllHeldSymbols().catch(console.error))
  console.log('[stocker] scheduler: node-cron fallback (no Redis)')
}

// ── Entry point (called from index.js) ───────────────────────────────────────

export function startScheduler() {
  if (process.env.ENABLE_SCHEDULER !== 'true') return
  if (process.env.REDIS_URL) {
    startBullMQ()
    console.log('[stocker] scheduler: BullMQ + Redis')
  } else {
    startCron()
  }
  // Warm market data on startup regardless of mode.
  runMarketRefresh().catch(() => {})
}
