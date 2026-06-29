// In-app notification channel — writes a row to the per-user notifications inbox.
import { randomUUID } from 'node:crypto'
import { db } from '../paytm.js'

export const id = 'inapp'

export async function send({ userId, title, body, symbol = null, alertId = null, kind = 'ALERT' }) {
  await db.execute({
    sql: `INSERT INTO notifications (id, user_id, kind, title, body, symbol, alert_id, read, created_at)
          VALUES (?,?,?,?,?,?,?,0,?)`,
    args: [randomUUID(), userId || null, kind, title, body || null, symbol, alertId, new Date().toISOString()],
  })
  return { ok: true, channel: 'inapp' }
}
