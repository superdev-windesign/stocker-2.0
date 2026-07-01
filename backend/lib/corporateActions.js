// Phase 6: Corporate actions — stock splits.
// Splits are company-level events (not user-specific), so the table has no user_id.
// Yahoo Finance returns RETROACTIVELY ADJUSTED historical prices after a split —
// meaning a pre-split transaction price in the ledger no longer matches Yahoo.
// Fix: detect splits via Yahoo events, store them, and apply ratio adjustments to
// transaction qty/price IN MEMORY before computing cost-basis or the equity curve.
// This keeps the raw ledger untouched while aligning math with Yahoo prices.
import { randomUUID } from 'node:crypto'
import { db } from './paytm.js'
import * as yahoo from './marketdata/yahoo.js'
import { cacheGet, cacheSet } from './cache.js'

let ready = false
async function ensureTable() {
  if (ready) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS corporate_actions (
      id       TEXT PRIMARY KEY,
      symbol   TEXT NOT NULL,
      type     TEXT NOT NULL,   -- SPLIT | DIVIDEND
      date     TEXT NOT NULL,   -- YYYY-MM-DD
      ratio    REAL,            -- SPLIT: shares-per-share ratio (e.g. 10 for a 10:1 split)
      amount   REAL,            -- DIVIDEND: per-share cash amount
      currency TEXT,
      UNIQUE(symbol, type, date)
    )
  `)
  ready = true
}

// Sync splits for one symbol from Yahoo. Redis key prevents re-syncing within 24h.
// bareSymbol  = canonical ticker without exchange suffix (NVDA, INFY)
// yahooSym    = Yahoo Finance symbol (NVDA, INFY.NS)
export async function syncSplits(bareSymbol, yahooSym) {
  await ensureTable()
  const sym = bareSymbol.toUpperCase()
  const cacheKey = `casync:${sym}`
  if (await cacheGet(cacheKey)) return  // synced recently

  let events = []
  try { events = await yahoo.splits(yahooSym) } catch (err) {
    console.warn(`[corp-actions] splits fetch ${yahooSym}: ${err.message}`)
  }

  for (const e of events) {
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO corporate_actions (id, symbol, type, date, ratio) VALUES (?,?,?,?,?)`,
        args: [randomUUID(), sym, 'SPLIT', e.date, e.ratio],
      })
    } catch { /* ignore unique constraint */ }
  }

  await cacheSet(cacheKey, 1, 24 * 3600_000)
  if (events.length) console.log(`[corp-actions] synced ${events.length} split(s) for ${sym}`)
}

// Batch-fetch splits for multiple bare symbols from DB.
// Returns { 'SYMBOL': [{ date, ratio }, ...ascending] }
export async function getSplitsForSymbols(symbols) {
  await ensureTable()
  if (!symbols.length) return {}
  const placeholders = symbols.map(() => '?').join(',')
  const res = await db.execute({
    sql: `SELECT symbol, date, ratio FROM corporate_actions
          WHERE symbol IN (${placeholders}) AND type = 'SPLIT'
          ORDER BY symbol, date ASC`,
    args: symbols.map((s) => s.toUpperCase()),
  })
  const out = {}
  for (const r of res.rows) {
    if (!out[r.symbol]) out[r.symbol] = []
    out[r.symbol].push({ date: r.date, ratio: Number(r.ratio) })
  }
  return out
}

// Adjust transaction qty/price IN MEMORY to align with Yahoo's split-adjusted prices.
// Rule: for each split that happened AFTER a transaction date, multiply qty by ratio
// and divide price by ratio. Total cost basis (qty × price) stays identical.
export function applySplitAdjustments(txns, splitsMap) {
  return txns.map((t) => {
    const sym = t.symbol.toUpperCase()
    const splits = splitsMap[sym]
    if (!splits?.length) return t
    let cumRatio = 1
    for (const s of splits) {
      if (s.date > t.date) cumRatio *= s.ratio
    }
    if (cumRatio === 1) return t
    return { ...t, quantity: t.quantity * cumRatio, price: t.price / cumRatio }
  })
}

// Sync splits for every distinct symbol across all transactions (called by scheduler).
// This is company-level data so we scan all transactions, not per-user.
export async function syncAllHeldSymbols() {
  await ensureTable()
  const res = await db.execute(
    `SELECT DISTINCT symbol, country FROM transactions WHERE symbol IS NOT NULL`,
  )
  for (const r of res.rows) {
    const sym = (r.symbol || '').toUpperCase()
    if (!sym) continue
    const yahooSym = (r.country || 'IN') === 'IN' ? `${sym}.NS` : sym
    try { await syncSplits(sym, yahooSym) }
    catch (err) { console.warn(`[corp-actions] sync failed ${sym}:`, err.message) }
  }
}

// Get all recorded splits (optionally filtered to a list of symbols) for display.
export async function listSplits(symbols) {
  await ensureTable()
  let res
  if (symbols?.length) {
    const placeholders = symbols.map(() => '?').join(',')
    res = await db.execute({
      sql: `SELECT symbol, date, ratio FROM corporate_actions
            WHERE symbol IN (${placeholders}) AND type = 'SPLIT' ORDER BY date DESC`,
      args: symbols.map((s) => s.toUpperCase()),
    })
  } else {
    res = await db.execute(
      `SELECT symbol, date, ratio FROM corporate_actions WHERE type = 'SPLIT' ORDER BY date DESC`,
    )
  }
  return res.rows.map((r) => ({
    symbol: r.symbol,
    date: r.date,
    ratio: Number(r.ratio),
    display: `${Number(r.ratio)}:1 split`,
  }))
}
