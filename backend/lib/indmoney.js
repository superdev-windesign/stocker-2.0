// INDstocks / INDmoney provider adapter (US + Indian stocks).
//
// Based on the INDstocks API skill: token-based auth (log in -> auth token -> send the
// token in a header on every request), REST endpoints for holdings, quotes, historical
// data, and a WebSocket for streaming. The skill documents the *structure*; the exact
// base URL, paths, header name and response field names must be confirmed against
// https://api-docs.indstocks.com (reachable from the deployed backend, not the dev sandbox).
// Those specifics are therefore ENV-CONFIGURABLE so they can be corrected without code
// changes. This app is read-only (no order placement).
//
// Auth model used here (lowest-risk, matches the rest of Stocker): the user logs in on
// INDstocks, obtains an access token, and we store it server-side in Turso; all data
// calls send it via the auth header. An OAuth redirect flow can replace exchange() later.
import { db } from './paytm.js'

// Defaults from INDstocks docs: base https://api.indstocks.com, portfolio under /portfolio,
// quotes under /market/quotes. Exact sub-paths are overridable via env if they differ.
const API_BASE = (process.env.INDSTOCKS_API_BASE || 'https://api.indstocks.com').replace(/\/$/, '')
const AUTH_HEADER = process.env.INDSTOCKS_AUTH_HEADER || 'Authorization'
const AUTH_SCHEME = process.env.INDSTOCKS_AUTH_SCHEME ?? 'Bearer ' // set to '' for a bare token
// A static API key (no secret needed) — used directly as the bearer for every request.
// If set, no login/token-paste is required.
const API_KEY = process.env.INDMONEY_API_KEY || process.env.INDSTOCKS_API_KEY || ''
const PATH_HOLDINGS = process.env.INDSTOCKS_PATH_HOLDINGS || '/portfolio/holdings'
const PATH_QUOTE = process.env.INDSTOCKS_PATH_QUOTE || '/market/quotes'
const PATH_HISTORICAL = process.env.INDSTOCKS_PATH_HISTORICAL || '/market/historical'

export const isConfigured = () => Boolean(API_BASE && (API_KEY || true))

let tableReady = false
async function ensureTable() {
  if (tableReady) return
  await db.execute(`
    CREATE TABLE IF NOT EXISTS indmoney_session (
      id       INTEGER PRIMARY KEY CHECK (id = 1),
      data     TEXT NOT NULL,
      saved_at TEXT NOT NULL
    )
  `)
  tableReady = true
}

export async function saveToken(tokens) {
  await ensureTable()
  await db.execute({
    sql: `INSERT INTO indmoney_session (id, data, saved_at) VALUES (1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at`,
    args: [JSON.stringify(tokens), new Date().toISOString()],
  })
}

export async function getStoredToken() {
  await ensureTable()
  const res = await db.execute(`SELECT data FROM indmoney_session WHERE id = 1`)
  if (!res.rows.length) return null
  try {
    return JSON.parse(res.rows[0].data)
  } catch {
    return null
  }
}

// Accepts a pasted/issued access token and persists it. (Swap for a real OAuth
// request-token exchange once the INDstocks login flow specifics are confirmed.)
export async function exchangeRequestToken(body = {}) {
  const token = body.access_token || body.token || body.request_token
  if (!token) {
    const e = new Error('access token is required')
    e.status = 400
    throw e
  }
  const tokens = { access_token: token, public_access_token: token, generated_at: new Date().toISOString() }
  await saveToken(tokens)
  return { public_access_token: token }
}

export async function getToken() {
  // With a server-side API key, the user is "connected" without pasting anything.
  if (API_KEY) {
    return { public_access_token: 'indstocks-connected', generated_at: new Date().toISOString(), expires_at: null }
  }
  const t = await getStoredToken()
  if (!t?.public_access_token) {
    const e = new Error('No INDstocks token stored. Please log in / paste a token first.')
    e.status = 404
    throw e
  }
  return {
    public_access_token: t.public_access_token,
    generated_at: t.generated_at,
    expires_at: t.expires_at || null,
  }
}

// The bearer used for API calls: the static API key if configured, else a stored token.
async function authValue() {
  if (API_KEY) return API_KEY
  const t = await getStoredToken()
  return t?.access_token || null
}

// Authenticated GET against the INDstocks REST API.
export async function indGet(path, query = {}) {
  if (!API_BASE) {
    const e = new Error('INDSTOCKS_API_BASE not configured')
    e.status = 501
    throw e
  }
  const token = await authValue()
  if (!token) {
    const e = new Error('Not logged in to INDstocks (set INDMONEY_API_KEY or paste a token)')
    e.status = 401
    throw e
  }
  const qs = new URLSearchParams(query).toString()
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`
  const resp = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      [AUTH_HEADER]: `${AUTH_SCHEME}${token}`,
    },
  })
  const text = await resp.text()
  let bodyOut
  try {
    bodyOut = JSON.parse(text)
  } catch {
    bodyOut = text
  }
  if (!resp.ok) {
    const e = new Error(typeof bodyOut === 'string' ? bodyOut : JSON.stringify(bodyOut))
    e.status = resp.status
    throw e
  }
  return bodyOut
}

// Read-only portfolio data. Response shapes are passed through; the field mapping to the
// app's normalized shape is finalized once a real response is observed on the docs/deploy.
export const getHoldings = () => indGet(PATH_HOLDINGS)
export const getQuote = (query) => indGet(PATH_QUOTE, query)
export const getHistorical = (query) => indGet(PATH_HISTORICAL, query)
