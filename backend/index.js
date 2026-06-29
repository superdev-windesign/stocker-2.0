// Stocker Express backend — multi-user edition.
// Phase 1: email/password auth via JWT httpOnly cookie; all /api/* routes require userId.

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import {
  apiKey,
  LOGIN_URL,
  getValidTokens,
  tokenExp,
  isValid,
  exchangeRequestToken,
  clearTokens,
  paytmGet,
  getPublicToken,
} from './lib/paytm.js'
import {
  listTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  importTransactions,
  clearTransactions,
  clearTransactionsBySource,
} from './lib/ledger.js'
import { listSnapshots } from './lib/nav.js'
import * as indmoney from './lib/indmoney.js'
import { listAlerts, addAlert, updateAlertStatus, deleteAlert, evaluateAlerts } from './lib/alerts.js'
import { listNotifications, markRead, markAllRead, notify } from './lib/notifications.js'
import { startScheduler } from './lib/scheduler.js'
import { generateInsight } from './lib/insights.js'
import { runAgent } from './lib/agent.js'
import * as av from './lib/marketdata/alphavantage.js'
import * as yahoo from './lib/marketdata/yahoo.js'
import * as wiki from './lib/marketdata/wiki.js'
import * as gnews from './lib/marketdata/news.js'
import authRouter from './routes/auth.js'
import { authMiddleware } from './middleware/authMiddleware.js'
import { ensureBrokerAccountsTable } from './lib/paytm.js'
import { getDerivedHoldings } from './lib/holdings.js'
import { listWatchlists, createWatchlist, deleteWatchlist, addItem, removeItem, ensureWatchlistTables } from './lib/watchlists.js'

const PORT = Number(process.env.PORT || 5174)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

if (!apiKey) {
  console.warn('\n[stocker] WARNING: PAYTM_API_KEY / PAYTM_API_SECRET missing — Paytm connect will fail.\n')
}

const app = express()
app.use(cors({ origin: FRONTEND_URL, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use((req, res, next) => {
  const q = Object.keys(req.query).length ? ` query=${JSON.stringify(req.query)}` : ''
  console.log(`[stocker] ${req.method} ${req.path}${q}`)
  next()
})

app.get('/health', (req, res) => res.json({ ok: true }))

// ── Auth (no middleware) ──────────────────────────────────────────────────────
app.use('/auth', authRouter)

// ── All /api/* routes require a valid Stocker session ─────────────────────────
app.use('/api', authMiddleware)

// ── Paytm broker connect (requires Stocker session) ──────────────────────────
// Step 1: redirect to Paytm login page.
app.get(['/api/login', '/login'], (req, res) => {
  if (!apiKey) return res.status(500).send('PAYTM_API_KEY not configured in .env')
  const state = Math.random().toString(36).slice(2)
  res.redirect(`${LOGIN_URL}${apiKey}&state=${state}`)
})

// Legacy return-URL handler (kept for local-only setups).
app.get('/', async (req, res) => {
  const requestToken = req.query.requestToken || req.query.request_token
  if (!requestToken) {
    return res.type('html').send(`
      <body style="font-family:system-ui;background:#0b0e11;color:#eaecef;display:grid;place-items:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h2>📈 Stocker</h2>
          <p style="color:#9aa4b2">Multi-user portfolio analytics platform.</p>
        </div>
      </body>`)
  }
  // Without userId we can't associate the token — redirect back with error.
  res.redirect(`${FRONTEND_URL}/?error=${encodeURIComponent('Please log in to Stocker before connecting your broker')}`)
})

// Step 2: exchange Paytm request_token and bind it to the authenticated user.
app.post('/api/exchange', async (req, res) => {
  const requestToken = req.body?.request_token || req.body?.requestToken
  if (!requestToken) return res.status(400).json({ error: 'request_token is required' })
  try {
    const tokens = await exchangeRequestToken(requestToken, req.userId)
    res.json({ public_access_token: tokens.public_access_token })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// Read cached Paytm token for this user.
app.get('/api/token', async (req, res) => {
  const tokens = await getValidTokens(req.userId)
  if (!tokens?.public_access_token) return res.status(404).json({ error: 'Paytm not connected. Please connect your account.' })
  const exp = tokenExp(tokens.access_token)
  res.json({
    public_access_token: tokens.public_access_token,
    generated_at: tokens.generated_at,
    expires_at: exp ? exp * 1000 : null,
  })
})

app.get('/api/token/retrieve', async (req, res) => {
  const tokens = await getValidTokens(req.userId)
  if (!tokens?.public_access_token) {
    return res.status(404).json({ error: 'No Paytm token. Please connect your account.', public_access_token: null })
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

// Disconnect Paytm broker account (not Stocker logout — that's POST /auth/logout).
app.post('/api/logout', async (req, res) => {
  await clearTokens(req.userId)
  res.json({ ok: true })
})

// ── Authenticated Paytm REST proxy ───────────────────────────────────────────
const proxy = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (err) {
    const status = err.status || 500
    if (status === 401) return res.status(401).json({ error: 'Paytm not connected. Please connect your account.' })
    console.error(`[stocker] proxy error (${status}):`, err.message)
    res.status(status).json({ error: err.message })
  }
}

app.get('/api/holdings', proxy(async (req) => {
  const holdings = await paytmGet('/holdings/v1/get-user-holdings-data', {}, req.userId)
  const value = await paytmGet('/holdings/v1/get-holdings-value', {}, req.userId).catch(() => null)
  return { holdings, value }
}))

// Derived holdings from ledger transactions + live Yahoo Finance quotes (CSV mode)
app.get('/api/holdings/derived', async (req, res) => {
  try {
    const holdings = await getDerivedHoldings(req.userId)
    res.json(holdings)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/orders',    proxy((req) => paytmGet('/orders/v1/user/orders', {}, req.userId)))
app.get('/api/positions', proxy((req) => paytmGet('/orders/v1/position', {}, req.userId)))

app.get('/api/debug', proxy(async (req) => {
  const safe = (p) => paytmGet(p, {}, req.userId).catch((e) => ({ __error: e.message, __status: e.status }))
  const [holdings, positions, orders] = await Promise.all([
    safe('/holdings/v1/get-user-holdings-data'),
    safe('/orders/v1/position'),
    safe('/orders/v1/user/orders'),
  ])
  return { holdings, positions, orders }
}))

app.get('/api/funds',       proxy((req) => paytmGet('/accounts/v1/funds/summary', { config: 'false' }, req.userId)))
app.get('/api/profile',     proxy((req) => paytmGet('/accounts/v1/user/details', {}, req.userId)))
app.get('/api/price-chart', proxy((req) => paytmGet('/data/v1/price-charts/sym', req.query, req.userId)))
app.get('/api/quote',       proxy((req) => paytmGet('/data/v1/price/live', req.query, req.userId)))

// ── Transaction ledger ────────────────────────────────────────────────────────
const ledgerHandler = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (err) {
    const status = err.status || 500
    if (status === 500) console.error('[stocker] ledger error:', err.message)
    res.status(status).json({ error: err.message })
  }
}

app.get('/api/transactions',                  ledgerHandler((req) => listTransactions(req.userId)))
app.post('/api/transactions',                 ledgerHandler((req) => addTransaction(req.userId, req.body)))
app.post('/api/transactions/import',          ledgerHandler((req) => importTransactions(req.userId, req.body?.transactions || req.body)))
app.put('/api/transactions/:id',              ledgerHandler((req) => updateTransaction(req.userId, req.params.id, req.body)))
app.delete('/api/transactions/:id',           ledgerHandler(async (req) => { await deleteTransaction(req.userId, req.params.id); return { ok: true } }))
app.delete('/api/transactions/source/:source',ledgerHandler((req) => clearTransactionsBySource(req.userId, req.params.source)))
app.delete('/api/transactions',               ledgerHandler(async (req) => { await clearTransactions(req.userId); return { ok: true } }))

app.get('/api/nav', ledgerHandler((req) => listSnapshots(req.userId)))

// ── INDmoney / INDstocks provider ─────────────────────────────────────────────
const indmoneyHandler = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (err) {
    const status = err.status || 500
    if (status === 500) console.error('[stocker] indmoney error:', err.message)
    res.status(status).json({ error: err.message })
  }
}
app.post('/api/indmoney/exchange',      indmoneyHandler((req) => indmoney.exchangeRequestToken(req.userId, req.body)))
app.post('/api/indmoney/logout',        indmoneyHandler(async (req) => { await indmoney.clearToken(req.userId); return { ok: true } }))
app.get('/api/indmoney/token',         indmoneyHandler((req) => indmoney.getToken(req.userId)))
app.get('/api/indmoney/token/retrieve',indmoneyHandler((req) => indmoney.getToken(req.userId)))
app.get('/api/indmoney/holdings',      indmoneyHandler((req) => indmoney.getHoldings(req.userId)))
app.get('/api/indmoney/quote',         indmoneyHandler((req) => indmoney.getQuote(req.query, req.userId)))

// ── Alerts + notifications ─────────────────────────────────────────────────────
app.get('/api/alerts',              ledgerHandler((req) => listAlerts(req.userId)))
app.post('/api/alerts',             ledgerHandler((req) => addAlert(req.userId, req.body)))
app.post('/api/alerts/:id/pause',   ledgerHandler((req) => updateAlertStatus(req.userId, req.params.id, 'PAUSED')))
app.post('/api/alerts/:id/resume',  ledgerHandler((req) => updateAlertStatus(req.userId, req.params.id, 'ACTIVE')))
app.delete('/api/alerts/:id',       ledgerHandler(async (req) => { await deleteAlert(req.userId, req.params.id); return { ok: true } }))

app.post('/api/alerts/evaluate-now', ledgerHandler(async (req) => {
  const fired = await evaluateAlerts(req.userId, req.body?.priceMap || {}, { portfolioPnlPct: req.body?.portfolioPnlPct })
  for (const f of fired) {
    await notify(req.userId, f.alert.channels, { title: f.title, body: f.body, symbol: f.alert.symbol, alertId: f.alert.id, kind: 'ALERT' })
  }
  return { fired: fired.map((f) => ({ id: f.alert.id, title: f.title })) }
}))

app.get('/api/notifications',        ledgerHandler((req) => listNotifications(req.userId)))
app.post('/api/notifications/read',  ledgerHandler(async (req) => { await markRead(req.userId, req.body?.id); return { ok: true } }))
app.post('/api/notifications/read-all', ledgerHandler(async (req) => { await markAllRead(req.userId); return { ok: true } }))

// ── AI Portfolio Analyst ──────────────────────────────────────────────────────
app.post('/api/insights', ledgerHandler((req) =>
  generateInsight(req.body?.scope || 'daily', req.body?.payload || {}, { refresh: !!req.body?.refresh }),
))

app.post('/api/agent', ledgerHandler((req) =>
  runAgent(req.body?.message || '', req.body?.context || {}, req.body?.history || []),
))

// ── Market data (AlphaVantage) ────────────────────────────────────────────────
app.get('/api/market/quote',     ledgerHandler((req) => av.quote(String(req.query.symbol || '').toUpperCase())))
app.get('/api/market/history',   ledgerHandler((req) => av.history(String(req.query.symbol || '').toUpperCase(), req.query.full === '1')))
app.get('/api/market/search',    ledgerHandler((req) => av.search(String(req.query.q || ''))))
app.get('/api/market/movers',    ledgerHandler(() => av.movers()))
app.get('/api/market/overview',  ledgerHandler((req) => av.overview(String(req.query.symbol || '').toUpperCase())))
app.get('/api/market/news',      ledgerHandler((req) => av.news(String(req.query.tickers || ''), String(req.query.topics || ''))))
// Yahoo Finance (no key required — indices + India data)
app.get('/api/market/indices',        ledgerHandler(() => yahoo.indices()))
app.get('/api/market/sentiment',      ledgerHandler(() => yahoo.sentiment()))
app.get('/api/market/sector-indices', ledgerHandler((req) => yahoo.sectorIndices(String(req.query.region || 'IN'))))
app.get('/api/market/us-quotes',      ledgerHandler(() => yahoo.usQuotes()))

// ── Watchlists ────────────────────────────────────────────────────────────────
app.get('/api/watchlists',                    ledgerHandler((req) => listWatchlists(req.userId)))
app.post('/api/watchlists',                   ledgerHandler((req) => createWatchlist(req.userId, req.body?.name)))
app.delete('/api/watchlists/:id',             ledgerHandler((req) => deleteWatchlist(req.userId, req.params.id)))
app.post('/api/watchlists/:id/items',         ledgerHandler((req) => addItem(req.userId, req.params.id, req.body || {})))
app.delete('/api/watchlists/:id/items/:symbol', ledgerHandler((req) => removeItem(req.userId, req.params.id, req.params.symbol)))
app.get('/api/market/yahoo-chart',    ledgerHandler((req) => {
  const { symbol, interval = '5m', range = '1d' } = req.query
  if (!symbol) throw Object.assign(new Error('symbol required'), { status: 400 })
  return yahoo.chart(String(symbol), String(interval), String(range))
}))
app.get('/api/market/yahoo-quote',    ledgerHandler((req) => {
  const { symbol } = req.query
  if (!symbol) throw Object.assign(new Error('symbol required'), { status: 400 })
  return yahoo.quote(String(symbol))
}))
app.get('/api/market/stock-news',     ledgerHandler((req) => {
  const { q } = req.query
  if (!q) throw Object.assign(new Error('q required'), { status: 400 })
  return gnews.search(String(q))
}))
app.get('/api/market/profile',        ledgerHandler((req) => {
  const { q } = req.query
  if (!q) throw Object.assign(new Error('q required'), { status: 400 })
  return wiki.summary(String(q))
}))

// Full Nifty 50 live quotes — 60 s cache per symbol inside yahoo.quote()
const N50 = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR','ITC','KOTAKBANK','LT','SBIN',
  'BHARTIARTL','BAJFINANCE','ASIANPAINT','AXISBANK','MARUTI','HCLTECH','SUNPHARMA','WIPRO',
  'TITAN','TATAMOTORS','ADANIENT','ADANIPORTS','NTPC','POWERGRID','ULTRACEMCO','TECHM',
  'TATASTEEL','JSWSTEEL','GRASIM','BAJAJFINSV','HEROMOTOCO','DIVISLAB','DRREDDY','EICHERMOT',
  'APOLLOHOSP','CIPLA','BPCL','COALINDIA','BRITANNIA','ONGC','M&M','NESTLEIND','HINDALCO',
  'TATACONSUM','INDUSINDBK','LTIM','BAJAJ-AUTO','SHRIRAMFIN','BEL','SBILIFE',
]
app.get('/api/market/nse-quotes', ledgerHandler(() =>
  Promise.allSettled(N50.map((s) => yahoo.quote(`${s}.NS`).then((q) => ({ ...q, nsSymbol: s }))))
    .then((rs) => rs.filter((r) => r.status === 'fulfilled').map((r) => r.value)),
))

// Run DB migrations before accepting traffic.
Promise.all([ensureBrokerAccountsTable(), ensureWatchlistTables()]).then(() => {
  app.listen(PORT, () => {
    console.log(`\n[stocker] backend running on http://localhost:${PORT}`)
    startScheduler()
  })
}).catch((err) => {
  console.error('[stocker] DB init failed:', err.message)
  process.exit(1)
})
