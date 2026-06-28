// Alert engine — all operations scoped by userId.
import { randomUUID } from 'node:crypto'
import { db } from './paytm.js'

export const ALERT_TYPES = [
  'PRICE_ABOVE',
  'PRICE_BELOW',
  'PCT_CHANGE',
  'REENTRY_ZONE',
  'NEAR_52W_HIGH',
  'NEAR_52W_LOW',
  'PORTFOLIO_PNL_PCT',
]

let ready = false
async function ensureTable() {
  if (ready) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS alerts (
      id           TEXT PRIMARY KEY,
      user_id      TEXT,
      symbol       TEXT,
      security_id  TEXT,
      exchange     TEXT DEFAULT 'NSE',
      type         TEXT NOT NULL,
      threshold    REAL,
      direction    TEXT,
      note         TEXT,
      status       TEXT NOT NULL DEFAULT 'ACTIVE',
      repeat       INTEGER NOT NULL DEFAULT 0,
      channels     TEXT NOT NULL DEFAULT 'inapp',
      last_value   REAL,
      last_checked_at TEXT,
      triggered_at TEXT,
      created_at   TEXT NOT NULL
    )
  `)
  const info = await db.execute(`PRAGMA table_info(alerts)`)
  const cols = new Set(info.rows.map((r) => r.name))
  if (!cols.has('user_id')) await db.execute(`ALTER TABLE alerts ADD COLUMN user_id TEXT`)
  ready = true
}

const toApi = (r) => ({
  id: r.id,
  symbol: r.symbol,
  securityId: r.security_id,
  exchange: r.exchange,
  type: r.type,
  threshold: r.threshold == null ? null : Number(r.threshold),
  direction: r.direction,
  note: r.note,
  status: r.status,
  repeat: Number(r.repeat) ? 1 : 0,
  channels: (r.channels || 'inapp').split(',').filter(Boolean),
  lastValue: r.last_value == null ? null : Number(r.last_value),
  lastCheckedAt: r.last_checked_at,
  triggeredAt: r.triggered_at,
  createdAt: r.created_at,
})

function clean(a) {
  const bad = (m) => {
    const e = new Error(m)
    e.status = 400
    throw e
  }
  const type = String(a.type || '').toUpperCase()
  if (!ALERT_TYPES.includes(type)) bad(`type must be one of ${ALERT_TYPES.join(', ')}`)
  if (type !== 'PORTFOLIO_PNL_PCT' && !a.symbol) bad('symbol is required for this alert type')
  if (a.threshold == null || Number.isNaN(Number(a.threshold))) bad('threshold is required')
  const channels = Array.isArray(a.channels) ? a.channels : String(a.channels || 'inapp').split(',')
  return {
    symbol: a.symbol ? String(a.symbol).toUpperCase() : null,
    securityId: a.securityId != null ? String(a.securityId) : null,
    exchange: (a.exchange ? String(a.exchange) : 'NSE').toUpperCase(),
    type,
    threshold: Number(a.threshold),
    direction: a.direction ? String(a.direction).toUpperCase() : null,
    note: a.note ? String(a.note) : null,
    repeat: a.repeat ? 1 : 0,
    channels: channels.map((c) => String(c).trim()).filter(Boolean).join(',') || 'inapp',
  }
}

export async function listAlerts(userId) {
  await ensureTable()
  const res = await db.execute({
    sql: `SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC`,
    args: [userId],
  })
  return res.rows.map(toApi)
}

export async function addAlert(userId, a) {
  await ensureTable()
  const c = clean(a)
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO alerts (id, user_id, symbol, security_id, exchange, type, threshold, direction, note, status, repeat, channels, created_at)
          VALUES (?,?,?,?,?,?,?,?,?, 'ACTIVE', ?, ?, ?)`,
    args: [id, userId, c.symbol, c.securityId, c.exchange, c.type, c.threshold, c.direction, c.note, c.repeat, c.channels, createdAt],
  })
  return { id, status: 'ACTIVE', createdAt, ...c }
}

export async function updateAlertStatus(userId, id, status) {
  await ensureTable()
  const res = await db.execute({
    sql: `UPDATE alerts SET status=? WHERE id=? AND user_id=?`,
    args: [status, id, userId],
  })
  if (res.rowsAffected === 0) {
    const e = new Error('Alert not found')
    e.status = 404
    throw e
  }
  return { id, status }
}

export async function deleteAlert(userId, id) {
  await ensureTable()
  await db.execute({ sql: `DELETE FROM alerts WHERE id=? AND user_id=?`, args: [id, userId] })
}

async function markFired(alert, value) {
  const now = new Date().toISOString()
  const status = alert.repeat ? 'ACTIVE' : 'TRIGGERED'
  await db.execute({
    sql: `UPDATE alerts SET status=?, last_value=?, triggered_at=?, last_checked_at=? WHERE id=?`,
    args: [status, value, now, now, alert.id],
  })
}

async function markChecked(id, value) {
  await db.execute({
    sql: `UPDATE alerts SET last_value=?, last_checked_at=? WHERE id=?`,
    args: [value ?? null, new Date().toISOString(), id],
  })
}

function check(alert, quote, ctx) {
  const t = alert.threshold
  if (alert.type === 'PORTFOLIO_PNL_PCT') {
    const v = ctx?.portfolioPnlPct
    if (v == null) return { value: null, fired: false }
    const fired = alert.direction === 'BELOW' ? v <= t : v >= t
    return { value: v, fired, label: `Portfolio P&L ${v.toFixed(2)}%` }
  }
  if (!quote || quote.last == null) return { value: null, fired: false }
  const p = Number(quote.last)
  switch (alert.type) {
    case 'PRICE_ABOVE':
      return { value: p, fired: p >= t, label: `${alert.symbol} at ${p}` }
    case 'PRICE_BELOW':
    case 'REENTRY_ZONE':
      return { value: p, fired: p <= t, label: `${alert.symbol} at ${p}` }
    case 'PCT_CHANGE': {
      const c = Number(quote.changePct)
      if (Number.isNaN(c)) return { value: null, fired: false }
      const fired = alert.direction === 'BELOW' ? c <= -Math.abs(t) : c >= Math.abs(t)
      return { value: c, fired, label: `${alert.symbol} ${c.toFixed(2)}% today` }
    }
    case 'NEAR_52W_LOW': {
      if (quote.low52 == null) return { value: p, fired: false }
      const fired = p <= quote.low52 * (1 + t / 100)
      return { value: p, fired, label: `${alert.symbol} near 52w low (${quote.low52})` }
    }
    case 'NEAR_52W_HIGH': {
      if (quote.high52 == null) return { value: p, fired: false }
      const fired = p >= quote.high52 * (1 - t / 100)
      return { value: p, fired, label: `${alert.symbol} near 52w high (${quote.high52})` }
    }
    default:
      return { value: p, fired: false }
  }
}

const titleFor = (a) =>
  ({
    PRICE_ABOVE: `${a.symbol} rose above ${a.threshold}`,
    PRICE_BELOW: `${a.symbol} fell below ${a.threshold}`,
    REENTRY_ZONE: `${a.symbol} hit your re-entry price ${a.threshold}`,
    PCT_CHANGE: `${a.symbol} moved ${a.threshold}% today`,
    NEAR_52W_LOW: `${a.symbol} is near its 52-week low`,
    NEAR_52W_HIGH: `${a.symbol} is near its 52-week high`,
    PORTFOLIO_PNL_PCT: `Portfolio P&L crossed ${a.threshold}%`,
  })[a.type] || `Alert: ${a.symbol}`

export async function evaluateAlerts(userId, priceMap = {}, ctx = {}) {
  await ensureTable()
  const alerts = (await listAlerts(userId)).filter((a) => a.status === 'ACTIVE')
  const fired = []
  for (const a of alerts) {
    const quote = a.symbol ? priceMap[a.symbol] || priceMap[String(a.symbol).toUpperCase()] : null
    const { value, fired: didFire, label } = check(a, quote, ctx)
    if (didFire) {
      await markFired(a, value)
      fired.push({
        alert: a,
        value,
        title: titleFor(a),
        body: `${label ?? ''}${a.note ? ` — ${a.note}` : ''}`.trim(),
      })
    } else {
      await markChecked(a.id, value)
    }
  }
  return fired
}
