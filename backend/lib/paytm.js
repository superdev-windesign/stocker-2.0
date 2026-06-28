// Shared Paytm + Turso logic for the Stocker Express backend.
// broker_accounts table replaces the legacy single-row sessions table so each user
// can connect their own Paytm account.

import { createClient } from '@libsql/client'

const API_KEY = process.env.PAYTM_API_KEY || process.env.VITE_PAYTM_API_KEY
const API_SECRET = process.env.PAYTM_API_SECRET || process.env.VITE_PAYTM_API_SECRET

export const LOGIN_URL = 'https://login.paytmmoney.com/merchant-login?apiKey='
const GETTOKEN_URL = 'https://developer.paytmmoney.com/accounts/v2/gettoken'
const PAYTM_HOST = 'https://developer.paytmmoney.com'

export const apiKey = API_KEY

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export { db }

// ── broker_accounts table (replaces the legacy single-row sessions table) ────
let baReady = false
async function ensureBrokerAccountsTable() {
  if (baReady) return
  // Keep the legacy sessions table so existing single-user data isn't broken while
  // we migrate. broker_accounts is the multi-user successor.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id       INTEGER PRIMARY KEY CHECK (id = 1),
      data     TEXT NOT NULL,
      saved_at TEXT NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS broker_accounts (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      provider   TEXT NOT NULL,
      token_data TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'active',
      saved_at   TEXT NOT NULL,
      UNIQUE(user_id, provider)
    )
  `)
  baReady = true
}

// Decode the `exp` (UNIX seconds) from a JWT without verifying the signature.
export function tokenExp(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString())
    return payload.exp || null
  } catch {
    return null
  }
}

export function isValid(t) {
  if (!t?.access_token) return false
  const exp = tokenExp(t.access_token)
  return exp ? exp * 1000 > Date.now() : true
}

// ── Per-user broker token ops ─────────────────────────────────────────────────

export async function getTokens(userId) {
  await ensureBrokerAccountsTable()
  const res = await db.execute({
    sql: `SELECT token_data FROM broker_accounts WHERE user_id = ? AND provider = 'paytm'`,
    args: [userId],
  })
  if (!res.rows.length) return null
  try {
    return JSON.parse(res.rows[0].token_data)
  } catch {
    return null
  }
}

export async function getValidTokens(userId) {
  const t = await getTokens(userId)
  if (!t) return null
  if (!isValid(t)) {
    await clearTokens(userId)
    return null
  }
  return t
}

export async function saveTokens(userId, tokens) {
  await ensureBrokerAccountsTable()
  const { randomUUID } = await import('node:crypto')
  await db.execute({
    sql: `INSERT INTO broker_accounts (id, user_id, provider, token_data, status, saved_at)
          VALUES (?, ?, 'paytm', ?, 'active', ?)
          ON CONFLICT(user_id, provider) DO UPDATE SET
            token_data = excluded.token_data,
            status     = 'active',
            saved_at   = excluded.saved_at`,
    args: [randomUUID(), userId, JSON.stringify(tokens), new Date().toISOString()],
  })
}

export async function clearTokens(userId) {
  await ensureBrokerAccountsTable()
  await db.execute({
    sql: `DELETE FROM broker_accounts WHERE user_id = ? AND provider = 'paytm'`,
    args: [userId],
  })
}

export async function exchangeRequestToken(requestToken, userId) {
  if (!API_KEY || !API_SECRET) {
    const e = new Error('PAYTM_API_KEY / PAYTM_API_SECRET not configured')
    e.status = 500
    throw e
  }
  const resp = await fetch(GETTOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'openapi-client-src': 'sdk' },
    body: JSON.stringify({
      api_key: API_KEY,
      api_secret_key: API_SECRET,
      request_token: requestToken,
    }),
  })
  const text = await resp.text()
  if (!resp.ok) {
    const e = new Error(`Token exchange failed (${resp.status}): ${text}`)
    e.status = resp.status
    throw e
  }
  const tokens = { ...JSON.parse(text), generated_at: new Date().toISOString() }
  await saveTokens(userId, tokens)
  return tokens
}

export async function paytmGet(path, query = {}, userId) {
  const tokens = await getValidTokens(userId)
  if (!tokens?.access_token) {
    const e = new Error('Paytm not connected. Please connect your Paytm account.')
    e.status = 401
    throw e
  }
  const qs = new URLSearchParams(query).toString()
  const url = `${PAYTM_HOST}${path}${qs ? `?${qs}` : ''}`
  const resp = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'openapi-client-src': 'sdk',
      'x-jwt-token': tokens.access_token,
    },
  })
  const text = await resp.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  if (!resp.ok) {
    const e = new Error(typeof body === 'string' ? body : JSON.stringify(body))
    e.status = resp.status
    throw e
  }
  return body
}

// Convenience: get the public_access_token for a user (used by the frontend
// WebSocket connection and the token-status endpoint).
export async function getPublicToken(userId) {
  const t = await getValidTokens(userId)
  return t?.public_access_token || null
}
