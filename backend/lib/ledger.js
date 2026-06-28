// Transaction ledger — lifetime buy/sell history. All queries are scoped by userId.
import { randomUUID } from 'node:crypto'
import { db } from './paytm.js'

let tableReady = false
async function ensureTable() {
  if (tableReady) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          TEXT PRIMARY KEY,
      user_id     TEXT,
      security_id TEXT,
      symbol      TEXT NOT NULL,
      name        TEXT,
      exchange    TEXT NOT NULL DEFAULT 'NSE',
      type        TEXT NOT NULL,
      date        TEXT NOT NULL,
      quantity    REAL NOT NULL,
      price       REAL NOT NULL,
      charges     REAL NOT NULL DEFAULT 0,
      notes       TEXT,
      source      TEXT NOT NULL DEFAULT 'manual',
      currency    TEXT NOT NULL DEFAULT 'INR',
      country     TEXT NOT NULL DEFAULT 'IN',
      ext_id      TEXT,
      created_at  TEXT NOT NULL
    )
  `)
  // Additive migrations for DBs created before these columns existed.
  const info = await db.execute(`PRAGMA table_info(transactions)`)
  const cols = new Set(info.rows.map((r) => r.name))
  if (!cols.has('currency')) await db.execute(`ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR'`)
  if (!cols.has('country'))  await db.execute(`ALTER TABLE transactions ADD COLUMN country  TEXT NOT NULL DEFAULT 'IN'`)
  if (!cols.has('ext_id'))   await db.execute(`ALTER TABLE transactions ADD COLUMN ext_id   TEXT`)
  if (!cols.has('user_id'))  await db.execute(`ALTER TABLE transactions ADD COLUMN user_id  TEXT`)
  tableReady = true
}

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
  currency: r.currency || 'INR',
  country: r.country || 'IN',
  extId: r.ext_id || null,
  createdAt: r.created_at,
})

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
  const exchange = (tx.exchange ? String(tx.exchange) : 'NSE').toUpperCase()
  const country = (tx.country ? String(tx.country) : exchange === 'NASDAQ' || exchange === 'NYSE' ? 'US' : 'IN').toUpperCase()
  const currency = (tx.currency ? String(tx.currency) : country === 'US' ? 'USD' : 'INR').toUpperCase()
  return {
    securityId: tx.securityId != null ? String(tx.securityId) : null,
    symbol,
    name: tx.name ? String(tx.name) : null,
    exchange,
    type,
    date,
    quantity,
    price,
    charges: Number(tx.charges) || 0,
    notes: tx.notes ? String(tx.notes) : null,
    source: tx.source ? String(tx.source) : 'manual',
    currency,
    country,
    extId: tx.extId != null && tx.extId !== '' ? String(tx.extId) : null,
  }
}

export async function listTransactions(userId) {
  await ensureTable()
  const res = await db.execute({
    sql: `SELECT * FROM transactions WHERE user_id = ? ORDER BY date ASC, created_at ASC`,
    args: [userId],
  })
  return res.rows.map(toApi)
}

export async function addTransaction(userId, tx) {
  await ensureTable()
  const c = clean(tx)
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  await db.execute({
    sql: `INSERT INTO transactions
            (id, user_id, security_id, symbol, name, exchange, type, date, quantity, price, charges, notes, source, currency, country, ext_id, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, userId, c.securityId, c.symbol, c.name, c.exchange, c.type, c.date, c.quantity, c.price, c.charges, c.notes, c.source, c.currency, c.country, c.extId, createdAt],
  })
  return { id, createdAt, ...c }
}

export async function updateTransaction(userId, id, tx) {
  await ensureTable()
  const c = clean(tx)
  const res = await db.execute({
    sql: `UPDATE transactions SET
            security_id=?, symbol=?, name=?, exchange=?, type=?, date=?, quantity=?, price=?, charges=?, notes=?, source=?, currency=?, country=?
          WHERE id=? AND user_id=?`,
    args: [c.securityId, c.symbol, c.name, c.exchange, c.type, c.date, c.quantity, c.price, c.charges, c.notes, c.source, c.currency, c.country, id, userId],
  })
  if (res.rowsAffected === 0) {
    const e = new Error('Transaction not found')
    e.status = 404
    throw e
  }
  return { id, ...c }
}

export async function deleteTransaction(userId, id) {
  await ensureTable()
  await db.execute({ sql: `DELETE FROM transactions WHERE id=? AND user_id=?`, args: [id, userId] })
}

export async function importTransactions(userId, rows) {
  await ensureTable()
  if (!Array.isArray(rows) || !rows.length) return { added: 0, skipped: 0, replacedBaseline: 0 }
  const createdAt = new Date().toISOString()
  let cleaned = rows.map(clean)

  const seen = new Set()
  cleaned = cleaned.filter((c) => {
    if (!c.extId) return true
    if (seen.has(c.extId)) return false
    seen.add(c.extId)
    return true
  })
  const batchIds = [...seen]
  let already = new Set()
  for (let i = 0; i < batchIds.length; i += 400) {
    const chunk = batchIds.slice(i, i + 400)
    const ph = chunk.map(() => '?').join(',')
    const r = await db.execute({
      sql: `SELECT ext_id FROM transactions WHERE user_id=? AND ext_id IN (${ph})`,
      args: [userId, ...chunk],
    })
    for (const row of r.rows) already.add(row.ext_id)
  }
  const toInsert = cleaned.filter((c) => !c.extId || !already.has(c.extId))
  const skipped = rows.length - toInsert.length

  let replacedBaseline = 0
  const realSymbols = [...new Set(toInsert.filter((c) => c.source !== 'paytm').map((c) => c.symbol))]
  if (realSymbols.length) {
    const ph = realSymbols.map(() => '?').join(',')
    const res = await db.execute({
      sql: `DELETE FROM transactions WHERE user_id=? AND source='paytm' AND symbol IN (${ph})`,
      args: [userId, ...realSymbols],
    })
    replacedBaseline = res.rowsAffected || 0
  }

  if (toInsert.length) {
    const stmts = toInsert.map((c) => ({
      sql: `INSERT INTO transactions
              (id, user_id, security_id, symbol, name, exchange, type, date, quantity, price, charges, notes, source, currency, country, ext_id, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [randomUUID(), userId, c.securityId, c.symbol, c.name, c.exchange, c.type, c.date, c.quantity, c.price, c.charges, c.notes, c.source, c.currency, c.country, c.extId, createdAt],
    }))
    await db.batch(stmts, 'write')
  }
  return { added: toInsert.length, skipped, replacedBaseline }
}

export async function clearTransactions(userId) {
  await ensureTable()
  await db.execute({ sql: `DELETE FROM transactions WHERE user_id=?`, args: [userId] })
}

export async function clearTransactionsBySource(userId, source) {
  await ensureTable()
  const res = await db.execute({
    sql: `DELETE FROM transactions WHERE user_id=? AND source=?`,
    args: [userId, source],
  })
  return { deleted: res.rowsAffected || 0 }
}
