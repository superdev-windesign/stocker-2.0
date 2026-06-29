// AlphaVantage-backed market-data endpoints (independent of your broker).
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

async function get(path, params) {
  const qs = params ? `?${new URLSearchParams(params)}` : ''
  const res = await fetch(`${BACKEND_URL}${path}${qs}`, { credentials: 'include' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return body
}

export const marketQuote     = (symbol) => get('/api/market/quote', { symbol })
export const marketHistory   = (symbol, full) => get('/api/market/history', full ? { symbol, full: 1 } : { symbol })
export const marketSearch    = (q) => get('/api/market/search', { q })
export const marketMovers    = () => get('/api/market/movers')
export const marketOverview  = (symbol) => get('/api/market/overview', { symbol })
export const marketIndices   = () => get('/api/market/indices')
export const marketSectors   = (region = 'IN') => get('/api/market/sector-indices', { region })
export const marketSentiment = () => get('/api/market/sentiment')
export const marketNseQuotes = () => get('/api/market/nse-quotes')
export const marketUsQuotes  = () => get('/api/market/us-quotes')
// Yahoo OHLCV chart — interval/range pairs: ('5m','1d'), ('1d','1y'), ('1wk','5y') etc.
export const marketChart     = (symbol, interval = '5m', range = '1d') =>
  get('/api/market/yahoo-chart', { symbol, interval, range })
// Yahoo single quote — price, prevClose, open/high/low, 52-wk, volume (any symbol w/ .NS/.BO suffix).
export const marketYahooQuote = (symbol) => get('/api/market/yahoo-quote', { symbol })
export const marketNews      = (tickers = '', topics = '') => get('/api/market/news', { ...(tickers && { tickers }), ...(topics && { topics }) })
