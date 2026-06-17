// In-app notification inbox + the notify() fan-out across channels (in-app, email).
// Channels implement a small NotifyChannel interface { id, send(payload) }.
import { db } from './paytm.js'
import * as inapp from './providers/notify.inapp.js'
import * as email from './providers/notify.email.js'

const CHANNELS = { inapp, email }

let ready = false
async function ensureTable() {
  if (ready) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY,
      kind       TEXT NOT NULL,         -- ALERT | AI_SUMMARY | SYSTEM
      title      TEXT NOT NULL,
      body       TEXT,
      symbol     TEXT,
      alert_id   TEXT,
      read       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)
  ready = true
}

const toApi = (r) => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  symbol: r.symbol,
  alertId: r.alert_id,
  read: Number(r.read) ? 1 : 0,
  createdAt: r.created_at,
})

export async function listNotifications(limit = 50) {
  await ensureTable()
  const res = await db.execute({
    sql: `SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?`,
    args: [limit],
  })
  const rows = res.rows.map(toApi)
  const unread = rows.filter((n) => !n.read).length
  return { notifications: rows, unread }
}

export async function markRead(id) {
  await ensureTable()
  await db.execute({ sql: `UPDATE notifications SET read=1 WHERE id=?`, args: [id] })
}

export async function markAllRead() {
  await ensureTable()
  await db.execute(`UPDATE notifications SET read=1 WHERE read=0`)
}

/**
 * Fan a payload out to the requested channels. In-app always persists to the inbox;
 * other channels best-effort (failures are logged, never throw, so one bad channel
 * doesn't drop the alert).
 *
 * @param {string[]} channels  e.g. ['inapp','email']
 * @param {object} payload     { title, body, symbol, alertId, kind }
 */
export async function notify(channels = ['inapp'], payload) {
  await ensureTable()
  const list = channels?.length ? channels : ['inapp']
  const results = []
  for (const name of list) {
    const ch = CHANNELS[name]
    if (!ch) continue
    try {
      results.push(await ch.send(payload))
    } catch (err) {
      console.error(`[stocker] notify channel ${name} failed:`, err.message)
      results.push({ ok: false, channel: name, error: err.message })
    }
  }
  return results
}
