import { randomUUID } from 'node:crypto'
import { db } from './paytm.js'

let ready = false
async function ensureTable() {
  if (ready) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'email',
      password_hash TEXT,
      created_at    TEXT NOT NULL
    )
  `)
  // Additive migrations
  const info = await db.execute(`PRAGMA table_info(users)`)
  const cols = new Set(info.rows.map((r) => r.name))
  if (!cols.has('reset_token'))   await db.execute(`ALTER TABLE users ADD COLUMN reset_token   TEXT`)
  if (!cols.has('reset_expires')) await db.execute(`ALTER TABLE users ADD COLUMN reset_expires TEXT`)
  ready = true
}

export async function createUser({ email, name, passwordHash }) {
  await ensureTable()
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO users (id, email, name, auth_provider, password_hash, created_at)
          VALUES (?, ?, ?, 'email', ?, ?)`,
    args: [id, email.toLowerCase().trim(), name || null, passwordHash, createdAt],
  })
  return { id, email: email.toLowerCase().trim(), name: name || null, createdAt }
}

export async function findByEmail(email) {
  await ensureTable()
  const res = await db.execute({
    sql: `SELECT * FROM users WHERE email = ?`,
    args: [email.toLowerCase().trim()],
  })
  return res.rows[0] || null
}

export async function findById(id) {
  await ensureTable()
  const res = await db.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [id] })
  return res.rows[0] || null
}

export async function countUsers() {
  await ensureTable()
  const res = await db.execute(`SELECT COUNT(*) as n FROM users`)
  return Number(res.rows[0].n)
}

export async function storeResetToken(userId, token) {
  await ensureTable()
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
  await db.execute({
    sql: `UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?`,
    args: [token, expires, userId],
  })
}

export async function findByResetToken(token) {
  await ensureTable()
  const res = await db.execute({
    sql: `SELECT * FROM users WHERE reset_token = ?`,
    args: [token],
  })
  return res.rows[0] || null
}

export async function updatePassword(userId, passwordHash) {
  await ensureTable()
  await db.execute({
    sql: `UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?`,
    args: [passwordHash, userId],
  })
}
