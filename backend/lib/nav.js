// Daily portfolio NAV (net asset value) snapshots — a real time-series of portfolio
// value, written once per day by the Phase 4 EOD scheduler. The read endpoint exists
// from Phase 2 (returns [] until the cron starts populating it), so the dashboard can
// render a real portfolio-value trend instead of the bundled benchmark interpolation.
import { db } from './paytm.js'

let ready = false
async function ensureTable() {
  if (ready) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nav_snapshots (
      date           TEXT PRIMARY KEY,   -- YYYY-MM-DD (one row/day)
      invested       REAL,
      current_value  REAL,
      realized_pnl   REAL,
      unrealized_pnl REAL,
      holdings_count INTEGER,
      created_at     TEXT NOT NULL
    )
  `)
  ready = true
}

export async function listSnapshots() {
  await ensureTable()
  const res = await db.execute(`SELECT * FROM nav_snapshots ORDER BY date ASC`)
  return res.rows.map((r) => ({
    date: r.date,
    invested: Number(r.invested),
    currentValue: Number(r.current_value),
    realizedPnl: Number(r.realized_pnl),
    unrealizedPnl: Number(r.unrealized_pnl),
    holdingsCount: Number(r.holdings_count),
  }))
}

// Upsert today's snapshot (called by the EOD cron in Phase 4).
export async function writeSnapshot(date, s) {
  await ensureTable()
  await db.execute({
    sql: `INSERT INTO nav_snapshots (date, invested, current_value, realized_pnl, unrealized_pnl, holdings_count, created_at)
          VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(date) DO UPDATE SET
            invested=excluded.invested, current_value=excluded.current_value,
            realized_pnl=excluded.realized_pnl, unrealized_pnl=excluded.unrealized_pnl,
            holdings_count=excluded.holdings_count`,
    args: [date, s.invested, s.currentValue, s.realizedPnl, s.unrealizedPnl, s.holdingsCount, new Date().toISOString()],
  })
}
