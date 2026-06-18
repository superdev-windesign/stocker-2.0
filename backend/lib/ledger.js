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
      currency    TEXT NOT NULL DEFAULT 'INR',
      country     TEXT NOT NULL DEFAULT 'IN',
      ext_id      TEXT,                            -- broker trade/order id (for dedup)
      created_at  TEXT NOT NULL
    )
  `)
  // Additive migration for DBs created before currency/country/ext_id existed.
  const info = await db.execute(`PRAGMA table_info(transactions)`)
  const cols = new Set(info.rows.map((r) => r.name))
  if (!cols.has('currency')) await db.execute(`ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR'`)
  if (!cols.has('country')) await db.execute(`ALTER TABLE transactions ADD COLUMN country TEXT NOT NULL DEFAULT 'IN'`)
  if (!cols.has('ext_id')) await db.execute(`ALTER TABLE transactions ADD COLUMN ext_id TEXT`)
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
  currency: r.currency || 'INR',
  country: r.country || 'IN',
  extId: r.ext_id || null,
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
  const exchange = (tx.exchange ? String(tx.exchange) : 'NSE').toUpperCase()
  // Country/currency default to India; derive from exchange, allow explicit override.
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
            (id, security_id, symbol, name, exchange, type, date, quantity, price, charges, notes, source, currency, country, ext_id, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, c.securityId, c.symbol, c.name, c.exchange, c.type, c.date, c.quantity, c.price, c.charges, c.notes, c.source, c.currency, c.country, c.extId, createdAt],
  })
  return { id, createdAt, ...c }
}

export async function updateTransaction(id, tx) {
  await ensureTable()
  const c = clean(tx)
  const res = await db.execute({
    sql: `UPDATE transactions SET
            security_id=?, symbol=?, name=?, exchange=?, type=?, date=?, quantity=?, price=?, charges=?, notes=?, source=?, currency=?, country=?
          WHERE id=?`,
    args: [c.securityId, c.symbol, c.name, c.exchange, c.type, c.date, c.quantity, c.price, c.charges, c.notes, c.source, c.currency, c.country, id],
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
// Real imports (CSV/manual) for a symbol SUPERSEDE any approximate Paytm "baseline"
// rows for that symbol, so importing your tradebook replaces the synced placeholder.
export async function importTransactions(rows) {
  await ensureTable()
  if (!Array.isArray(rows) || !rows.length) return { added: 0, skipped: 0, replacedBaseline: 0 }
  const createdAt = new Date().toISOString()
  let cleaned = rows.map(clean)

  // De-dup within the batch by ext_id (broker trade/order id) so the same row isn't
  // inserted twice, and across the DB so re-uploading the same tradebook is idempotent.
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
    const r = await db.execute({ sql: `SELECT ext_id FROM transactions WHERE ext_id IN (${ph})`, args: chunk })
    for (const row of r.rows) already.add(row.ext_id)
  }
  const toInsert = cleaned.filter((c) => !c.extId || !already.has(c.extId))
  const skipped = rows.length - toInsert.length

  // Real imports for a symbol supersede any approximate Paytm baseline for that symbol.
  let replacedBaseline = 0
  const realSymbols = [...new Set(toInsert.filter((c) => c.source !== 'paytm').map((c) => c.symbol))]
  if (realSymbols.length) {
    const ph = realSymbols.map(() => '?').join(',')
    const res = await db.execute({ sql: `DELETE FROM transactions WHERE source='paytm' AND symbol IN (${ph})`, args: realSymbols })
    replacedBaseline = res.rowsAffected || 0
  }

  if (toInsert.length) {
    const stmts = toInsert.map((c) => ({
      sql: `INSERT INTO transactions
              (id, security_id, symbol, name, exchange, type, date, quantity, price, charges, notes, source, currency, country, ext_id, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [randomUUID(), c.securityId, c.symbol, c.name, c.exchange, c.type, c.date, c.quantity, c.price, c.charges, c.notes, c.source, c.currency, c.country, c.extId, createdAt],
    }))
    await db.batch(stmts, 'write')
  }
  return { added: toInsert.length, skipped, replacedBaseline }
}

export async function clearTransactions() {
  await ensureTable()
  await db.execute(`DELETE FROM transactions`)
}

// Clear only rows from a given source (e.g. 'paytm' baseline placeholders).
export async function clearTransactionsBySource(source) {
  await ensureTable()
  const res = await db.execute({ sql: `DELETE FROM transactions WHERE source=?`, args: [source] })
  return { deleted: res.rowsAffected || 0 }
}
