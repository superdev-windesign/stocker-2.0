// Standalone Express backend for Stocker (the "token helper" + Paytm REST proxy).
//
// Why a backend at all: Paytm's token exchange (request_token -> access tokens) can't
// run in the browser — the endpoint blocks cross-origin calls and your api_secret must
// never ship in frontend code. This server holds the secret, runs the exchange, persists
// the session to Turso, and proxies Paytm's REST APIs using the server-side access_token.
//
// All shared Paytm + Turso logic lives in ./lib/paytm.js.

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import {
  apiKey,
  LOGIN_URL,
  getValidTokens,
  tokenExp,
  isValid,
  exchangeRequestToken,
  clearTokens,
  paytmGet,
} from './lib/paytm.js'
import {
  listTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  importTransactions,
  clearTransactions,
} from './lib/ledger.js'
import { listSnapshots } from './lib/nav.js'
import * as indmoney from './lib/indmoney.js'
import { listAlerts, addAlert, updateAlertStatus, deleteAlert, evaluateAlerts } from './lib/alerts.js'
import { listNotifications, markRead, markAllRead, notify } from './lib/notifications.js'
import { startScheduler } from './lib/scheduler.js'

const PORT = Number(process.env.PORT || 5174)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

if (!apiKey) {
  console.warn('\n[stocker] WARNING: PAYTM_API_KEY / PAYTM_API_SECRET missing in .env — token exchange will fail.\n')
}

const app = express()
app.use(cors({ origin: FRONTEND_URL }))
app.use(express.json())

// Log every incoming request (method, path, query) — invaluable for debugging the login flow.
app.use((req, res, next) => {
  const q = Object.keys(req.query).length ? ` query=${JSON.stringify(req.query)}` : ''
  console.log(`[stocker] ${req.method} ${req.path}${q}`)
  next()
})

// Lightweight health check for hosting platforms (Render/Railway) — always 200.
app.get('/health', (req, res) => res.json({ ok: true }))

// Step 1: send the user to Paytm's login page. ('/login' kept as a back-compat alias.)
app.get(['/api/login', '/login'], (req, res) => {
  if (!apiKey) return res.status(500).send('PAYTM_API_KEY not configured in .env')
  const state = Math.random().toString(36).slice(2)
  res.redirect(`${LOGIN_URL}${apiKey}&state=${state}`)
})

// Local Return-URL callback. NOTE: in this deployment the Paytm Return URL points at the
// hosted site, so Paytm redirects there (not here) and the React app exchanges the token
// via POST /api/exchange. This handler stays for local-only return-url setups.
app.get('/', async (req, res) => {
  const requestToken = req.query.requestToken || req.query.request_token
  if (!requestToken) {
    return res.type('html').send(`
      <body style="font-family:system-ui;background:#0b0e11;color:#eaecef;display:grid;place-items:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h2>📈 Stocker — Paytm token helper</h2>
          <p style="color:#9aa4b2">Click below to log in to Paytm and generate your access token.</p>
          <a href="/api/login" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none">Login with Paytm</a>
        </div>
      </body>`)
  }
  try {
    await exchangeRequestToken(requestToken)
    console.log('[stocker] tokens generated OK; session cached & persisted in Turso.')
    res.redirect(`${FRONTEND_URL}/?connected=1`)
  } catch (err) {
    console.error('[stocker] exchange error:', err)
    res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent(err.message)}`)
  }
})

// Step 4: the React app reads the cached public_access_token here on load.
app.get('/api/token', async (req, res) => {
  const tokens = await getValidTokens()
  if (!tokens?.public_access_token) return res.status(404).json({ error: 'No token yet. Log in first.' })
  const exp = tokenExp(tokens.access_token)
  res.json({
    public_access_token: tokens.public_access_token,
    generated_at: tokens.generated_at,
    expires_at: exp ? exp * 1000 : null,
  })
})

// Retrieve the stored token + expiry info (powers "copy stored token from DB").
app.get('/api/token/retrieve', async (req, res) => {
  const tokens = await getValidTokens()
  if (!tokens?.public_access_token) {
    return res.status(404).json({ error: 'No token stored. Please log in first.', public_access_token: null })
  }
  const exp = tokenExp(tokens.access_token)
  res.json({
    public_access_token: tokens.public_access_token,
    generated_at: tokens.generated_at,
    expires_at: exp ? exp * 1000 : null,
    is_valid: isValid(tokens),
    expires_in_hours: exp ? Math.round((exp * 1000 - Date.now()) / (1000 * 60 * 60)) : 'unknown',
  })
})

// Manual exchange: POST { request_token }. Used by the React app on the Return-URL callback.
app.post('/api/exchange', async (req, res) => {
  const requestToken = req.body?.request_token || req.body?.requestToken
  if (!requestToken) return res.status(400).json({ error: 'request_token is required' })
  try {
    const tokens = await exchangeRequestToken(requestToken)
    res.json({ public_access_token: tokens.public_access_token })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// Clear the cached session (Turso).
app.post('/api/logout', async (req, res) => {
  await clearTokens()
  res.json({ ok: true })
})

// ── Authenticated Paytm REST proxy ───────────────────────────────────────────
const proxy = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (err) {
    const status = err.status || 500
    if (status === 401) return res.status(401).json({ error: 'Not logged in. Please log in to Paytm.' })
    console.error(`[stocker] proxy error (${status}):`, err.message)
    res.status(status).json({ error: err.message })
  }
}

app.get('/api/holdings', proxy(async () => {
  const holdings = await paytmGet('/holdings/v1/get-user-holdings-data')
  const value = await paytmGet('/holdings/v1/get-holdings-value').catch(() => null)
  return { holdings, value }
}))

app.get('/api/orders', proxy(() => paytmGet('/orders/v1/user/orders')))
app.get('/api/positions', proxy(() => paytmGet('/orders/v1/position')))

app.get('/api/debug', proxy(async () => {
  const safe = (p) => paytmGet(p).catch((e) => ({ __error: e.message, __status: e.status }))
  const [holdings, positions, orders] = await Promise.all([
    safe('/holdings/v1/get-user-holdings-data'),
    safe('/orders/v1/position'),
    safe('/orders/v1/user/orders'),
  ])
  return { holdings, positions, orders }
}))

app.get('/api/funds', proxy(() => paytmGet('/accounts/v1/funds/summary', { config: 'false' })))
app.get('/api/profile', proxy(() => paytmGet('/accounts/v1/user/details')))
app.get('/api/price-chart', proxy((req) => paytmGet('/data/v1/price-charts/sym', req.query)))
app.get('/api/quote', proxy((req) => paytmGet('/data/v1/price/live', req.query)))

// ── Transaction ledger (lifetime buy/sell history) ───────────────────────────
// Persisted in Turso. Powers Stock Journey, trade analytics, re-entry tracking.
const ledgerHandler = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (err) {
    const status = err.status || 500
    if (status === 500) console.error('[stocker] ledger error:', err.message)
    res.status(status).json({ error: err.message })
  }
}

app.get('/api/transactions', ledgerHandler(() => listTransactions()))
app.post('/api/transactions', ledgerHandler((req) => addTransaction(req.body)))
app.post('/api/transactions/import', ledgerHandler((req) => importTransactions(req.body?.transactions || req.body)))
app.put('/api/transactions/:id', ledgerHandler((req) => updateTransaction(req.params.id, req.body)))
app.delete('/api/transactions/:id', ledgerHandler(async (req) => {
  await deleteTransaction(req.params.id)
  return { ok: true }
}))
app.delete('/api/transactions', ledgerHandler(async () => {
  await clearTransactions()
  return { ok: true }
}))

// Portfolio NAV time-series (populated daily by the scheduler; empty until then).
app.get('/api/nav', ledgerHandler(() => listSnapshots()))

// ── INDmoney / INDstocks provider (US + Indian stocks) ──────────────────────
// Token-based: user logs in on INDstocks, pastes/issues a token to /exchange, which
// is stored; data routes proxy the INDstocks REST API with it. Needs INDSTOCKS_API_BASE
// (+ a token) configured to work — returns clear errors until then.
const indmoneyHandler = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (err) {
    const status = err.status || 500
    if (status === 500) console.error('[stocker] indmoney error:', err.message)
    res.status(status).json({ error: err.message })
  }
}
app.post('/api/indmoney/exchange', indmoneyHandler((req) => indmoney.exchangeRequestToken(req.body)))
app.get('/api/indmoney/token', indmoneyHandler(() => indmoney.getToken()))
app.get('/api/indmoney/token/retrieve', indmoneyHandler(() => indmoney.getToken()))
app.get('/api/indmoney/holdings', indmoneyHandler(() => indmoney.getHoldings()))
app.get('/api/indmoney/quote', indmoneyHandler((req) => indmoney.getQuote(req.query)))

// ── Alert engine + notifications (Phase 4) ───────────────────────────────────
app.get('/api/alerts', ledgerHandler(() => listAlerts()))
app.post('/api/alerts', ledgerHandler((req) => addAlert(req.body)))
app.post('/api/alerts/:id/pause', ledgerHandler((req) => updateAlertStatus(req.params.id, 'PAUSED')))
app.post('/api/alerts/:id/resume', ledgerHandler((req) => updateAlertStatus(req.params.id, 'ACTIVE')))
app.delete('/api/alerts/:id', ledgerHandler(async (req) => {
  await deleteAlert(req.params.id)
  return { ok: true }
}))

// Manual evaluation — drives the engine end-to-end without the scheduler/network.
// Body: { priceMap: { SYMBOL: { last, changePct, high52, low52 } }, portfolioPnlPct }
app.post('/api/alerts/evaluate-now', ledgerHandler(async (req) => {
  const fired = await evaluateAlerts(req.body?.priceMap || {}, { portfolioPnlPct: req.body?.portfolioPnlPct })
  for (const f of fired) {
    await notify(f.alert.channels, { title: f.title, body: f.body, symbol: f.alert.symbol, alertId: f.alert.id, kind: 'ALERT' })
  }
  return { fired: fired.map((f) => ({ id: f.alert.id, title: f.title })) }
}))

app.get('/api/notifications', ledgerHandler(() => listNotifications()))
app.post('/api/notifications/read', ledgerHandler(async (req) => {
  await markRead(req.body?.id)
  return { ok: true }
}))
app.post('/api/notifications/read-all', ledgerHandler(async () => {
  await markAllRead()
  return { ok: true }
}))

app.listen(PORT, () => {
  console.log(`\n[stocker] token helper running on http://localhost:${PORT}`)
  console.log(`[stocker] Start login at: http://localhost:${PORT}/api/login\n`)
  startScheduler()
})
