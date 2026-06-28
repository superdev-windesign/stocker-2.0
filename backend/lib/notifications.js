// In-app notification inbox + notify() fan-out. All operations scoped by userId.
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
      user_id    TEXT,
      kind       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT,
      symbol     TEXT,
      alert_id   TEXT,
      read       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)
  const info = await db.execute(`PRAGMA table_info(notifications)`)
  const cols = new Set(info.rows.map((r) => r.name))
  if (!cols.has('user_id')) await db.execute(`ALTER TABLE notifications ADD COLUMN user_id TEXT`)
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

export async function listNotifications(userId, limit = 50) {
  await ensureTable()
  const res = await db.execute({
    sql: `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    args: [userId, limit],
  })
  const rows = res.rows.map(toApi)
  const unread = rows.filter((n) => !n.read).length
  return { notifications: rows, unread }
}

export async function markRead(userId, id) {
  await ensureTable()
  await db.execute({ sql: `UPDATE notifications SET read=1 WHERE id=? AND user_id=?`, args: [id, userId] })
}

export async function markAllRead(userId) {
  await ensureTable()
  await db.execute({ sql: `UPDATE notifications SET read=1 WHERE user_id=? AND read=0`, args: [userId] })
}

/**
 * Fan a payload out to the requested channels. In-app always persists to the inbox;
 * other channels are best-effort (failures are logged but never throw).
 *
 * @param {string}   userId
 * @param {string[]} channels  e.g. ['inapp','email']
 * @param {object}   payload   { title, body, symbol, alertId, kind }
 */
export async function notify(userId, channels = ['inapp'], payload) {
  await ensureTable()
  const list = channels?.length ? channels : ['inapp']
  const results = []
  for (const name of list) {
    const ch = CHANNELS[name]
    if (!ch) continue
    try {
      results.push(await ch.send({ ...payload, userId }))
    } catch (err) {
      console.error(`[stocker] notify channel ${name} failed:`, err.message)
      results.push({ ok: false, channel: name, error: err.message })
    }
  }
  return results
}
