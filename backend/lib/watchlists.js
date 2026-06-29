// User watchlists — named lists of stocks/indices, scoped per user.
// Two tables: watchlists (the list) + watchlist_items (symbols in a list).
import { randomUUID } from 'node:crypto'
import { db } from './paytm.js'

let ready = false
export async function ensureWatchlistTables() {
  if (ready) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS watchlists (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      name       TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS watchlist_items (
      id           TEXT PRIMARY KEY,
      watchlist_id TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      symbol       TEXT NOT NULL,
      yahoo_symbol TEXT,
      name         TEXT,
      exchange     TEXT,
      type         TEXT NOT NULL DEFAULT 'stock',
      country      TEXT NOT NULL DEFAULT 'IN',
      created_at   TEXT NOT NULL,
      UNIQUE(watchlist_id, symbol)
    )
  `)
  ready = true
}

// Return all of a user's watchlists, each with its items.
export async function listWatchlists(userId) {
  await ensureWatchlistTables()
  const lists = await db.execute({
    sql: `SELECT id, name, created_at FROM watchlists WHERE user_id = ? ORDER BY created_at ASC`,
    args: [userId],
  })
  const items = await db.execute({
    sql: `SELECT id, watchlist_id, symbol, yahoo_symbol, name, exchange, type, country
          FROM watchlist_items WHERE user_id = ? ORDER BY created_at ASC`,
    args: [userId],
  })
  const byList = {}
  for (const it of items.rows) {
    ;(byList[it.watchlist_id] ||= []).push({
      symbol: it.symbol, yahooSymbol: it.yahoo_symbol, name: it.name,
      exchange: it.exchange, type: it.type, country: it.country,
    })
  }
  return lists.rows.map((l) => ({
    id: l.id, name: l.name, createdAt: l.created_at, items: byList[l.id] || [],
  }))
}

export async function createWatchlist(userId, name) {
  await ensureWatchlistTables()
  const id = randomUUID()
  await db.execute({
    sql: `INSERT INTO watchlists (id, user_id, name, created_at) VALUES (?, ?, ?, ?)`,
    args: [id, userId, String(name || 'Watchlist').slice(0, 60), new Date().toISOString()],
  })
  return { id, name, items: [] }
}

export async function deleteWatchlist(userId, id) {
  await ensureWatchlistTables()
  await db.execute({ sql: `DELETE FROM watchlist_items WHERE watchlist_id = ? AND user_id = ?`, args: [id, userId] })
  await db.execute({ sql: `DELETE FROM watchlists WHERE id = ? AND user_id = ?`, args: [id, userId] })
  return { ok: true }
}

export async function addItem(userId, listId, item) {
  await ensureWatchlistTables()
  // Verify the list belongs to the user
  const own = await db.execute({ sql: `SELECT id FROM watchlists WHERE id = ? AND user_id = ?`, args: [listId, userId] })
  if (!own.rows.length) { const e = new Error('Watchlist not found'); e.status = 404; throw e }
  const sym = String(item.symbol || '').toUpperCase()
  if (!sym) { const e = new Error('symbol required'); e.status = 400; throw e }
  await db.execute({
    sql: `INSERT OR IGNORE INTO watchlist_items
          (id, watchlist_id, user_id, symbol, yahoo_symbol, name, exchange, type, country, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [randomUUID(), listId, userId, sym, item.yahooSymbol || null, item.name || sym,
           item.exchange || 'NSE', item.type || 'stock', item.country || 'IN', new Date().toISOString()],
  })
  return { ok: true }
}

export async function removeItem(userId, listId, symbol) {
  await ensureWatchlistTables()
  await db.execute({
    sql: `DELETE FROM watchlist_items WHERE watchlist_id = ? AND user_id = ? AND symbol = ?`,
    args: [listId, userId, String(symbol).toUpperCase()],
  })
  return { ok: true }
}
