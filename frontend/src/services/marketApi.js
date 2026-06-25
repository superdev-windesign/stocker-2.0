// AlphaVantage-backed market-data endpoints (independent of your broker).
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

async function get(path, params) {
  const qs = params ? `?${new URLSearchParams(params)}` : ''
  const res = await fetch(`${BACKEND_URL}${path}${qs}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return body
}

export const marketQuote = (symbol) => get('/api/market/quote', { symbol })
export const marketHistory = (symbol, full) => get('/api/market/history', full ? { symbol, full: 1 } : { symbol })
export const marketSearch = (q) => get('/api/market/search', { q })
export const marketMovers = () => get('/api/market/movers')
export const marketOverview = (symbol) => get('/api/market/overview', { symbol })
