// Shared Paytm + Turso logic for the Stocker Express backend.
// broker_accounts table replaces the legacy single-row sessions table so each user
// can connect their own Paytm account.
// Phase 3: broker tokens are AES-256-GCM encrypted at rest via crypto.js.

import { createClient } from '@libsql/client'
import { encryptJson, decryptJson, isEncrypted } from './crypto.js'

const API_KEY    = process.env.PAYTM_API_KEY    || process.env.VITE_PAYTM_API_KEY
const API_SECRET = process.env.PAYTM_API_SECRET || process.env.VITE_PAYTM_API_SECRET

export const LOGIN_URL = 'https://login.paytmmoney.com/merchant-login?apiKey='
const GETTOKEN_URL = 'https://developer.paytmmoney.com/accounts/v2/gettoken'
const PAYTM_HOST   = 'https://developer.paytmmoney.com'

export const apiKey = API_KEY

const db = createClient({
  url:       process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export { db }

// ── broker_accounts table ─────────────────────────────────────────────────────
// Phase 3 migration: rename token_data → token_enc if the old column still exists.
let baReady = false
export async function ensureBrokerAccountsTable() {
  if (baReady) return

  // Legacy sessions table (kept for backward compat during migration).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id       INTEGER PRIMARY KEY CHECK (id = 1),
      data     TEXT NOT NULL,
      saved_at TEXT NOT NULL
    )
  `)

  // Create broker_accounts with token_enc if it doesn't exist yet.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS broker_accounts (
      id        TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL,
      provider  TEXT NOT NULL,
      token_enc TEXT NOT NULL,
      status    TEXT NOT NULL DEFAULT 'active',
      saved_at  TEXT NOT NULL,
      UNIQUE(user_id, provider)
    )
  `)

  // If the table was created before Phase 3, it has token_data. Rename it.
  const info = await db.execute(`PRAGMA table_info(broker_accounts)`)
  const cols = info.rows.map((r) => r.name)
  if (cols.includes('token_data') && !cols.includes('token_enc')) {
    await db.execute(`ALTER TABLE broker_accounts RENAME COLUMN token_data TO token_enc`)
    console.log('[stocker] migrated broker_accounts: token_data → token_enc')
  }

  baReady = true

  // Re-encrypt any existing plaintext rows (only runs if TOKEN_ENCRYPTION_KEY is set).
  await _reEncryptAllPlaintext()
}

async function _reEncryptAllPlaintext() {
  const { isEncrypted: enc, encryptJson: ejson } = await import('./crypto.js')
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key) return  // no key → nothing to encrypt

  const rows = await db.execute(`SELECT id, token_enc FROM broker_accounts`)
  for (const r of rows.rows) {
    if (!enc(r.token_enc)) {
      try {
        const plain = r.token_enc
        const parsed = JSON.parse(plain)
        await db.execute({
          sql:  `UPDATE broker_accounts SET token_enc = ? WHERE id = ?`,
          args: [ejson(parsed), r.id],
        })
        console.log(`[stocker] re-encrypted plaintext token row ${r.id}`)
      } catch (err) {
        console.warn(`[stocker] failed to re-encrypt row ${r.id}:`, err.message)
      }
    }
  }
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
    sql:  `SELECT token_enc FROM broker_accounts WHERE user_id = ? AND provider = 'paytm'`,
    args: [userId],
  })
  if (!res.rows.length) return null

  const stored = res.rows[0].token_enc
  const tokens = decryptJson(stored)
  if (!tokens) return null

  // Lazy re-encryption: if the stored value was plaintext, encrypt it now.
  if (!isEncrypted(stored)) {
    await _reEncrypt(userId, 'paytm', tokens)
  }

  return tokens
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
    sql: `INSERT INTO broker_accounts (id, user_id, provider, token_enc, status, saved_at)
          VALUES (?, ?, 'paytm', ?, 'active', ?)
          ON CONFLICT(user_id, provider) DO UPDATE SET
            token_enc = excluded.token_enc,
            status    = 'active',
            saved_at  = excluded.saved_at`,
    args: [randomUUID(), userId, encryptJson(tokens), new Date().toISOString()],
  })
}

export async function clearTokens(userId) {
  await ensureBrokerAccountsTable()
  await db.execute({
    sql:  `DELETE FROM broker_accounts WHERE user_id = ? AND provider = 'paytm'`,
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
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'openapi-client-src': 'sdk' },
    body:    JSON.stringify({ api_key: API_KEY, api_secret_key: API_SECRET, request_token: requestToken }),
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
  const qs  = new URLSearchParams(query).toString()
  const url = `${PAYTM_HOST}${path}${qs ? `?${qs}` : ''}`
  const resp = await fetch(url, {
    headers: {
      'Content-Type':      'application/json',
      'openapi-client-src': 'sdk',
      'x-jwt-token':        tokens.access_token,
    },
  })
  const text = await resp.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  if (!resp.ok) {
    const e = new Error(typeof body === 'string' ? body : JSON.stringify(body))
    e.status = resp.status
    throw e
  }
  return body
}

export async function getPublicToken(userId) {
  const t = await getValidTokens(userId)
  return t?.public_access_token || null
}

// Internal: write back an encrypted copy of an already-decoded token object.
async function _reEncrypt(userId, provider, tokenObj) {
  try {
    await db.execute({
      sql:  `UPDATE broker_accounts SET token_enc = ? WHERE user_id = ? AND provider = ?`,
      args: [encryptJson(tokenObj), userId, provider],
    })
  } catch (err) {
    console.warn(`[stocker] re-encrypt failed for ${provider}/${userId}:`, err.message)
  }
}
