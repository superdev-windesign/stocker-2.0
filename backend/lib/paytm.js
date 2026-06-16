// Shared Paytm + Turso logic for the Stocker Express backend (backend/index.js).
// Turso is the single source of truth for the session, so the server stays stateless —
// every call reads the token straight from the DB rather than an in-memory cache.

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

let tableReady = false
async function ensureTable() {
  if (tableReady) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id       INTEGER PRIMARY KEY CHECK (id = 1),
      data     TEXT NOT NULL,
      saved_at TEXT NOT NULL
    )
  `)
  tableReady = true
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

// A token set is usable only while its access_token JWT hasn't expired.
export function isValid(t) {
  if (!t?.access_token) return false
  const exp = tokenExp(t.access_token)
  return exp ? exp * 1000 > Date.now() : true
}

export async function getTokens() {
  await ensureTable()
  const result = await db.execute(`SELECT data FROM sessions WHERE id = 1`)
  if (!result.rows.length) return null
  try {
    return JSON.parse(result.rows[0].data)
  } catch {
    return null
  }
}

// Read the session and drop it if expired, so the UI re-prompts a login.
export async function getValidTokens() {
  const t = await getTokens()
  if (!t) return null
  if (!isValid(t)) {
    await clearTokens()
    return null
  }
  return t
}

export async function saveTokens(tokens) {
  await ensureTable()
  await db.execute({
    sql: `INSERT INTO sessions (id, data, saved_at) VALUES (1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at`,
    args: [JSON.stringify(tokens), new Date().toISOString()],
  })
}

export async function clearTokens() {
  await ensureTable()
  await db.execute(`DELETE FROM sessions WHERE id = 1`)
}

// Exchange a Paytm request_token for the token set and persist it to Turso.
export async function exchangeRequestToken(requestToken) {
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
  await saveTokens(tokens)
  return tokens
}

// Authenticated GET against Paytm's REST API using the stored access_token.
// Mirrors the official SDK: x-jwt-token header + openapi-client-src: 'sdk'.
export async function paytmGet(path, query = {}) {
  const tokens = await getValidTokens()
  if (!tokens?.access_token) {
    const e = new Error('Not logged in')
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
