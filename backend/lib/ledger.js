// Transaction ledger — the lifetime buy/sell history that powers Stock Journey,
// trade analytics, re-entry tracking, etc. Persisted in the same Turso DB as the
// Paytm session. Single-user (like the rest of the app), so no user scoping.
import { randomUUID } from 'node:crypto'
import { db } from './paytm.js'

let tableReady = false
async function ensureTable() {
  if (tableReady) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          TEXT PRIMARY KEY,
      security_id TEXT,
      symbol      TEXT NOT NULL,
      name        TEXT,
      exchange    TEXT NOT NULL DEFAULT 'NSE',
      type        TEXT NOT NULL,             -- BUY | SELL
      date        TEXT NOT NULL,             -- YYYY-MM-DD (trade date)
      quantity    REAL NOT NULL,
      price       REAL NOT NULL,             -- per share
      charges     REAL NOT NULL DEFAULT 0,
      notes       TEXT,
      source      TEXT NOT NULL DEFAULT 'manual',  -- manual | csv | paytm
      created_at  TEXT NOT NULL
    )
  `)
  tableReady = true
}

// DB row (snake_case) -> API shape (camelCase) the frontend consumes.
const toApi = (r) => ({
  id: r.id,
  securityId: r.security_id,
  symbol: r.symbol,
  name: r.name,
  exchange: r.exchange,
  type: r.type,
  date: r.date,
  quantity: Number(r.quantity),
  price: Number(r.price),
  charges: Number(r.charges) || 0,
  notes: r.notes,
  source: r.source,
  createdAt: r.created_at,
})

// Validate + coerce an incoming transaction. Throws a 400-tagged error if invalid.
function clean(tx) {
  const bad = (msg) => {
    const e = new Error(msg)
    e.status = 400
    throw e
  }
  const symbol = String(tx.symbol || '').trim().toUpperCase()
  if (!symbol) bad('symbol is required')
  const type = String(tx.type || '').trim().toUpperCase()
  if (type !== 'BUY' && type !== 'SELL') bad('type must be BUY or SELL')
  const date = String(tx.date || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad('date must be YYYY-MM-DD')
  const quantity = Number(tx.quantity)
  if (!(quantity > 0)) bad('quantity must be > 0')
  const price = Number(tx.price)
  if (!(price >= 0)) bad('price must be >= 0')
  return {
    securityId: tx.securityId != null ? String(tx.securityId) : null,
    symbol,
    name: tx.name ? String(tx.name) : null,
    exchange: (tx.exchange ? String(tx.exchange) : 'NSE').toUpperCase(),
    type,
    date,
    quantity,
    price,
    charges: Number(tx.charges) || 0,
    notes: tx.notes ? String(tx.notes) : null,
    source: tx.source ? String(tx.source) : 'manual',
  }
}

export async function listTransactions() {
  await ensureTable()
  // Chronological by trade date, then insertion order.
  const res = await db.execute(`SELECT * FROM transactions ORDER BY date ASC, created_at ASC`)
  return res.rows.map(toApi)
}

export async function addTransaction(tx) {
  await ensureTable()
  const c = clean(tx)
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO transactions
            (id, security_id, symbol, name, exchange, type, date, quantity, price, charges, notes, source, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, c.securityId, c.symbol, c.name, c.exchange, c.type, c.date, c.quantity, c.price, c.charges, c.notes, c.source, createdAt],
  })
  return { id, createdAt, ...c }
}

export async function updateTransaction(id, tx) {
  await ensureTable()
  const c = clean(tx)
  const res = await db.execute({
    sql: `UPDATE transactions SET
            security_id=?, symbol=?, name=?, exchange=?, type=?, date=?, quantity=?, price=?, charges=?, notes=?, source=?
          WHERE id=?`,
    args: [c.securityId, c.symbol, c.name, c.exchange, c.type, c.date, c.quantity, c.price, c.charges, c.notes, c.source, id],
  })
  if (res.rowsAffected === 0) {
    const e = new Error('Transaction not found')
    e.status = 404
    throw e
  }
  return { id, ...c }
}

export async function deleteTransaction(id) {
  await ensureTable()
  await db.execute({ sql: `DELETE FROM transactions WHERE id=?`, args: [id] })
}

// Bulk insert (CSV import or Paytm sync). Returns how many rows were added.
export async function importTransactions(rows) {
  await ensureTable()
  if (!Array.isArray(rows) || !rows.length) return { added: 0 }
  const createdAt = new Date().toISOString()
  const stmts = rows.map((tx) => {
    const c = clean(tx)
    return {
      sql: `INSERT INTO transactions
              (id, security_id, symbol, name, exchange, type, date, quantity, price, charges, notes, source, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [randomUUID(), c.securityId, c.symbol, c.name, c.exchange, c.type, c.date, c.quantity, c.price, c.charges, c.notes, c.source, createdAt],
    }
  })
  await db.batch(stmts, 'write')
  return { added: stmts.length }
}

export async function clearTransactions() {
  await ensureTable()
  await db.execute(`DELETE FROM transactions`)
}
