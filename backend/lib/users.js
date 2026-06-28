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
