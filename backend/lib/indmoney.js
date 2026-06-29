// INDstocks / INDmoney provider adapter (US + Indian stocks).
// Token storage uses the shared broker_accounts table (user-scoped).
// Phase 3: tokens are AES-256-GCM encrypted at rest via crypto.js.
import { db } from './paytm.js'
import { randomUUID } from 'node:crypto'
import { encryptJson, decryptJson, isEncrypted } from './crypto.js'

const API_BASE = (process.env.INDSTOCKS_API_BASE || 'https://api.indstocks.com').replace(/\/$/, '')
const AUTH_HEADER = process.env.INDSTOCKS_AUTH_HEADER || 'Authorization'
const AUTH_SCHEME = process.env.INDSTOCKS_AUTH_SCHEME ?? 'Bearer '
const API_KEY = process.env.INDMONEY_API_KEY || process.env.INDSTOCKS_API_KEY || ''
const PATH_HOLDINGS   = process.env.INDSTOCKS_PATH_HOLDINGS   || '/portfolio/holdings'
const PATH_QUOTE      = process.env.INDSTOCKS_PATH_QUOTE      || '/market/quotes'
const PATH_HISTORICAL = process.env.INDSTOCKS_PATH_HISTORICAL || '/market/historical'

export const isConfigured = () => Boolean(API_BASE)

// ── Per-user token ops via broker_accounts ────────────────────────────────────
// broker_accounts is created by paytm.js ensureBrokerAccountsTable(); no ensureTable needed here.

export async function saveToken(userId, tokens) {
  await db.execute({
    sql: `INSERT INTO broker_accounts (id, user_id, provider, token_enc, status, saved_at)
          VALUES (?, ?, 'indmoney', ?, 'active', ?)
          ON CONFLICT(user_id, provider) DO UPDATE SET
            token_enc = excluded.token_enc,
            status    = 'active',
            saved_at  = excluded.saved_at`,
    args: [randomUUID(), userId, encryptJson(tokens), new Date().toISOString()],
  })
}

export async function getStoredToken(userId) {
  // If a global API key is configured, every user is implicitly "connected".
  if (API_KEY) {
    return { access_token: API_KEY, public_access_token: 'indstocks-connected', generated_at: new Date().toISOString() }
  }
  const res = await db.execute({
    sql:  `SELECT token_enc FROM broker_accounts WHERE user_id = ? AND provider = 'indmoney'`,
    args: [userId],
  })
  if (!res.rows.length) return null

  const stored = res.rows[0].token_enc
  const tokens = decryptJson(stored)
  if (!tokens) return null

  // Lazy re-encryption: if stored value was plaintext, encrypt it now.
  if (!isEncrypted(stored)) {
    try {
      await db.execute({
        sql:  `UPDATE broker_accounts SET token_enc = ? WHERE user_id = ? AND provider = 'indmoney'`,
        args: [encryptJson(tokens), userId],
      })
    } catch (err) {
      console.warn('[stocker] indmoney re-encrypt failed:', err.message)
    }
  }

  return tokens
}

export async function clearToken(userId) {
  await db.execute({
    sql:  `DELETE FROM broker_accounts WHERE user_id = ? AND provider = 'indmoney'`,
    args: [userId],
  })
}

// Accepts a pasted access token and persists it under the user's account.
export async function exchangeRequestToken(userId, body = {}) {
  const token = body.access_token || body.token || body.request_token
  if (!token) {
    const e = new Error('access token is required')
    e.status = 400
    throw e
  }
  const tokens = { access_token: token, public_access_token: token, generated_at: new Date().toISOString() }
  await saveToken(userId, tokens)
  return { public_access_token: token }
}

export async function getToken(userId) {
  if (API_KEY) {
    return { public_access_token: 'indstocks-connected', generated_at: new Date().toISOString(), expires_at: null }
  }
  const t = await getStoredToken(userId)
  if (!t?.public_access_token) {
    const e = new Error('INDstocks not connected. Please connect your account.')
    e.status = 404
    throw e
  }
  return { public_access_token: t.public_access_token, generated_at: t.generated_at, expires_at: t.expires_at || null }
}

async function authValue(userId) {
  if (API_KEY) return API_KEY
  const t = await getStoredToken(userId)
  return t?.access_token || null
}

export async function indGet(path, query = {}, userId) {
  if (!API_BASE) {
    const e = new Error('INDSTOCKS_API_BASE not configured')
    e.status = 501
    throw e
  }
  const token = await authValue(userId)
  if (!token) {
    const e = new Error('INDstocks not connected. Please connect your account.')
    e.status = 401
    throw e
  }
  const qs = new URLSearchParams(query).toString()
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json', [AUTH_HEADER]: `${AUTH_SCHEME}${token}` },
  })
  const text = await resp.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  if (!resp.ok) {
    const msg = typeof body === 'string' ? body : (body?.message || body?.error || JSON.stringify(body))
    const e = new Error(msg)
    e.status = resp.status
    throw e
  }
  return body
}

export const getHoldings  = (userId) => indGet(PATH_HOLDINGS, {}, userId)
export const getQuote     = (query, userId) => indGet(PATH_QUOTE, query, userId)
export const getHistorical = (query, userId) => indGet(PATH_HISTORICAL, query, userId)
