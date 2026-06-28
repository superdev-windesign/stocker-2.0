// Daily portfolio NAV snapshots — one row per user per day.
import { db } from './paytm.js'

let ready = false
async function ensureTable() {
  if (ready) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nav_snapshots (
      date           TEXT NOT NULL,
      user_id        TEXT NOT NULL,
      invested       REAL,
      current_value  REAL,
      realized_pnl   REAL,
      unrealized_pnl REAL,
      holdings_count INTEGER,
      created_at     TEXT NOT NULL,
      PRIMARY KEY (date, user_id)
    )
  `)
  // Additive migration: old schema had date as sole PK with no user_id.
  const info = await db.execute(`PRAGMA table_info(nav_snapshots)`)
  const cols = new Set(info.rows.map((r) => r.name))
  if (!cols.has('user_id')) {
    // Can't alter PK in SQLite. Rename and recreate.
    await db.execute(`ALTER TABLE nav_snapshots RENAME TO nav_snapshots_old`)
    await db.execute(`
      CREATE TABLE nav_snapshots (
        date           TEXT NOT NULL,
        user_id        TEXT NOT NULL,
        invested       REAL,
        current_value  REAL,
        realized_pnl   REAL,
        unrealized_pnl REAL,
        holdings_count INTEGER,
        created_at     TEXT NOT NULL,
        PRIMARY KEY (date, user_id)
      )
    `)
    // Migrate old rows with NULL user_id so claim-legacy can pick them up.
    await db.execute(`
      INSERT INTO nav_snapshots (date, user_id, invested, current_value, realized_pnl, unrealized_pnl, holdings_count, created_at)
      SELECT date, 'legacy', invested, current_value, realized_pnl, unrealized_pnl, holdings_count, created_at
      FROM nav_snapshots_old
    `)
    await db.execute(`DROP TABLE nav_snapshots_old`)
  }
  ready = true
}

export async function listSnapshots(userId) {
  await ensureTable()
  const res = await db.execute({
    sql: `SELECT * FROM nav_snapshots WHERE user_id = ? ORDER BY date ASC`,
    args: [userId],
  })
  return res.rows.map((r) => ({
    date: r.date,
    invested: Number(r.invested),
    currentValue: Number(r.current_value),
    realizedPnl: Number(r.realized_pnl),
    unrealizedPnl: Number(r.unrealized_pnl),
    holdingsCount: Number(r.holdings_count),
  }))
}

export async function writeSnapshot(userId, date, s) {
  await ensureTable()
  await db.execute({
    sql: `INSERT INTO nav_snapshots (date, user_id, invested, current_value, realized_pnl, unrealized_pnl, holdings_count, created_at)
          VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(date, user_id) DO UPDATE SET
            invested=excluded.invested, current_value=excluded.current_value,
            realized_pnl=excluded.realized_pnl, unrealized_pnl=excluded.unrealized_pnl,
            holdings_count=excluded.holdings_count`,
    args: [date, userId, s.invested, s.currentValue, s.realizedPnl, s.unrealizedPnl, s.holdingsCount, new Date().toISOString()],
  })
}
