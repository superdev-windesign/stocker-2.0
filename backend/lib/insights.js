// AI Portfolio Analyst (PRD Module 7). Takes a COMPACT computed-metrics payload (not raw
// holdings/ledger — to control tokens), generates a daily/weekly narrative via an LLM
// (OpenRouter, default openai/gpt-4o), caches it in Turso keyed by an inputs hash, and
// degrades gracefully to a deterministic heuristic when there's no key or the call fails.
//
// DEPLOY-ONLY for the live LLM: the dev sandbox can't reach openrouter.ai (egress). The
// heuristic path is the in-sandbox default and is fully testable locally.
import { createHash } from 'node:crypto'
import { db } from './paytm.js'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o'
const SITE_URL = process.env.OPENROUTER_SITE_URL || 'https://stocker-2-0-frontend.vercel.app'
const SITE_NAME = process.env.OPENROUTER_SITE_NAME || 'Stocker'

let ready = false
async function ensureTable() {
  if (ready) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS insight_cache (
      id          TEXT PRIMARY KEY,
      scope       TEXT NOT NULL,        -- DAILY | WEEKLY
      period_key  TEXT NOT NULL,        -- 2026-06-16 | 2026-W24
      text        TEXT NOT NULL,
      model       TEXT,                 -- openai/gpt-4o | heuristic
      inputs_hash TEXT,
      created_at  TEXT NOT NULL,
      UNIQUE(scope, period_key)
    )
  `)
  ready = true
}

const hash = (obj) => createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16)

const periodKey = (scope) => {
  const d = new Date()
  if (scope === 'WEEKLY') {
    const onejan = new Date(d.getFullYear(), 0, 1)
    const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7)
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
  }
  return d.toISOString().slice(0, 10)
}

const inr = (n) =>
  n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const pct = (n) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(1)}%`)

// Deterministic, no-LLM summary built straight from the metrics payload (PRD style).
export function heuristicInsight(p = {}, scope = 'DAILY') {
  const t = p.totals || {}
  // Currency-aware amount formatter (shadows the INR default for USD portfolios).
  const sym = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }[p.currency] || '₹'
  const inr = (n) =>
    n == null ? '—' : `${sym}${Number(n).toLocaleString(p.currency === 'INR' ? 'en-IN' : 'en-US', { maximumFractionDigits: 0 })}`
  const lines = []
  lines.push(
    `Your portfolio is worth ${inr(t.currentValue)} (invested ${inr(t.invested)}) — overall P&L ${inr(t.totalPnl)} (${pct(t.totalPnlPct)}).`,
  )
  if (t.dayChangeAbs != null)
    lines.push(`Today the portfolio moved ${inr(t.dayChangeAbs)} (${pct(t.dayChangePct)}).`)
  if (p.best?.symbol) lines.push(`Top performer: ${p.best.symbol} (${pct(p.best.pnlPct)}).`)
  if (p.worst?.symbol) lines.push(`Biggest laggard: ${p.worst.symbol} (${pct(p.worst.pnlPct)}).`)
  if (p.topProfit?.[0])
    lines.push(`Largest lifetime gain: ${p.topProfit[0].symbol} (${inr(p.topProfit[0].totalPnl)}).`)
  if (p.diversification?.topSector?.name)
    lines.push(
      `Concentration: ${Math.round(p.diversification.topSector.pct)}% in ${p.diversification.topSector.name}${p.diversification.score != null ? ` (diversification score ${Math.round(p.diversification.score)}/100)` : ''}.`,
    )
  if (p.realized?.closedCount)
    lines.push(
      `Realized: ${inr(p.realized.netRealized)} across ${p.realized.closedCount} closed positions${p.realized.winRate != null ? `, win rate ${Math.round(p.realized.winRate)}%` : ''}.`,
    )
  for (const r of (p.reentry || []).slice(0, 2)) {
    lines.push(
      `You sold ${r.symbol} at ${inr(r.lastSellPrice)}; it's now ${inr(r.lastPrice)} — ${pct(r.diffPct)} vs your exit. Possible re-entry to review.`,
    )
  }
  for (const a of (p.activity?.timesBoughtTop || []).slice(0, 1)) {
    lines.push(`You've bought ${a.symbol} ${a.timesBought} times and sold it ${a.timesSold} times.`)
  }
  return lines.join('\n')
}

async function callOpenRouter(payload, scope) {
  const system =
    'You are a concise portfolio analyst for an Indian retail investor. Amounts are in INR. ' +
    'Write a short ' +
    (scope === 'WEEKLY' ? 'weekly' : 'daily') +
    ' summary (2-3 sentences) followed by 4-6 sharp bullet insights about performance, ' +
    'concentration/risk, realized vs unrealized P&L, and any re-entry opportunities. ' +
    'Be specific with numbers from the data. Do NOT give prescriptive financial advice or ' +
    'buy/sell recommendations — frame re-entries as "worth reviewing". Plain text/markdown only.'
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': SITE_URL,
      'X-Title': SITE_NAME,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Portfolio metrics (JSON):\n${JSON.stringify(payload)}` },
      ],
      temperature: 0.4,
      max_tokens: 700,
    }),
  })
  if (!resp.ok) throw new Error(`OpenRouter ${resp.status}: ${await resp.text()}`)
  const data = await resp.json()
  const text = data?.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('OpenRouter returned no content')
  return text
}

/**
 * Get the insight for a scope. Returns cached text if the inputs are unchanged; otherwise
 * generates via the LLM (when OPENROUTER_API_KEY is set) and caches it; falls back to the
 * heuristic on no-key or any error.
 */
export async function generateInsight(scope = 'DAILY', payload = {}, { refresh = false } = {}) {
  await ensureTable()
  const sc = scope.toUpperCase() === 'WEEKLY' ? 'WEEKLY' : 'DAILY'
  const key = periodKey(sc)
  const inputsHash = hash(payload)

  if (!refresh) {
    const cached = await db.execute({
      sql: `SELECT * FROM insight_cache WHERE scope=? AND period_key=?`,
      args: [sc, key],
    })
    const row = cached.rows[0]
    if (row && row.inputs_hash === inputsHash) {
      return { text: row.text, model: row.model, cached: true, scope: sc, periodKey: key }
    }
  }

  let text
  let model
  if (OPENROUTER_KEY) {
    try {
      text = await callOpenRouter(payload, sc)
      model = MODEL
    } catch (err) {
      console.error('[stocker] insight LLM failed, using heuristic:', err.message)
    }
  }
  if (!text) {
    text = heuristicInsight(payload, sc)
    model = 'heuristic'
  }

  await db.execute({
    sql: `INSERT INTO insight_cache (id, scope, period_key, text, model, inputs_hash, created_at)
          VALUES (?,?,?,?,?,?,?)
          ON CONFLICT(scope, period_key) DO UPDATE SET
            text=excluded.text, model=excluded.model, inputs_hash=excluded.inputs_hash, created_at=excluded.created_at`,
    args: [`${sc}-${key}`, sc, key, text, model, inputsHash, new Date().toISOString()],
  })

  return { text, model, cached: false, scope: sc, periodKey: key }
}
