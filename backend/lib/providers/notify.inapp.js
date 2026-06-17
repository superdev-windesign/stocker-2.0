// In-app notification channel — writes a row to the notifications inbox. Needs no
// external credentials, so it's the MVP/default channel and the only one testable in
// the dev sandbox. Implements the NotifyChannel interface: send({ title, body, ... }).
import { randomUUID } from 'node:crypto'
import { db } from '../paytm.js'

export const id = 'inapp'

export async function send({ title, body, symbol = null, alertId = null, kind = 'ALERT' }) {
  await db.execute({
    sql: `INSERT INTO notifications (id, kind, title, body, symbol, alert_id, read, created_at)
          VALUES (?,?,?,?,?,?,0,?)`,
    args: [randomUUID(), kind, title, body || null, symbol, alertId, new Date().toISOString()],
  })
  return { ok: true, channel: 'inapp' }
}
