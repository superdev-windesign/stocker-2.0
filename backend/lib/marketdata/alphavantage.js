// AlphaVantage market-data provider — the independent "whole-market" feed (separate from
// brokers): quotes, full history, symbol search, top gainers/losers, and fundamentals.
// DEPLOY-ONLY (sandbox egress blocks alphavantage.co). The free tier is rate-limited
// (~25 req/day, 5/min) so responses are cached HARD in memory.
const API_KEY = process.env.ALPHAVANTAGE_API_KEY || ''
const BASE = 'https://www.alphavantage.co/query'

export const isConfigured = () => Boolean(API_KEY)

// Tiny TTL cache (process-memory). For multi-instance/scale this moves to Redis.
const cache = new Map()
async function memo(key, ttlMs, fn) {
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.val
  const val = await fn()
  cache.set(key, { exp: Date.now() + ttlMs, val })
  return val
}

async function av(params) {
  if (!API_KEY) {
    const e = new Error('ALPHAVANTAGE_API_KEY not configured')
    e.status = 501
    throw e
  }
  const qs = new URLSearchParams({ ...params, apikey: API_KEY }).toString()
  const resp = await fetch(`${BASE}?${qs}`)
  const j = await resp.json().catch(() => ({}))
  // AlphaVantage signals rate-limit / errors in the body, not the HTTP status.
  if (j.Note || j.Information) {
    const e = new Error(j.Note || j.Information)
    e.status = 429
    throw e
  }
  if (j['Error Message']) {
    const e = new Error(j['Error Message'])
    e.status = 400
    throw e
  }
  return j
}

const num = (v) => (v == null || v === '' || v === 'None' || Number.isNaN(Number(v)) ? null : Number(v))

export const quote = (symbol) =>
  memo(`q:${symbol}`, 60_000, async () => {
    const q = (await av({ function: 'GLOBAL_QUOTE', symbol }))['Global Quote'] || {}
    return {
      symbol: q['01. symbol'] || symbol,
      price: num(q['05. price']),
      open: num(q['02. open']),
      high: num(q['03. high']),
      low: num(q['04. low']),
      prevClose: num(q['08. previous close']),
      change: num(q['09. change']),
      changePct: num((q['10. change percent'] || '').replace('%', '')),
      volume: num(q['06. volume']),
      latestDay: q['07. latest trading day'] || null,
    }
  })

export const history = (symbol, full = false) =>
  memo(`h:${symbol}:${full ? 'full' : 'compact'}`, 30 * 60_000, async () => {
    const j = await av({ function: 'TIME_SERIES_DAILY', symbol, outputsize: full ? 'full' : 'compact' })
    const series = j['Time Series (Daily)'] || {}
    return Object.entries(series)
      .map(([date, v]) => ({
        date,
        open: num(v['1. open']),
        high: num(v['2. high']),
        low: num(v['3. low']),
        close: num(v['4. close']),
        volume: num(v['5. volume']),
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  })

export const search = (keywords) =>
  memo(`s:${keywords}`, 24 * 3600_000, async () => {
    const j = await av({ function: 'SYMBOL_SEARCH', keywords })
    return (j.bestMatches || []).map((m) => ({
      symbol: m['1. symbol'],
      name: m['2. name'],
      type: m['3. type'],
      region: m['4. region'],
      currency: m['8. currency'],
    }))
  })

export const movers = () =>
  memo('movers', 60 * 60_000, async () => {
    const j = await av({ function: 'TOP_GAINERS_LOSERS' })
    const map = (arr) =>
      (arr || []).slice(0, 15).map((x) => ({
        symbol: x.ticker,
        price: num(x.price),
        change: num(x.change_amount),
        changePct: num((x.change_percentage || '').replace('%', '')),
        volume: num(x.volume),
      }))
    return {
      gainers: map(j.top_gainers),
      losers: map(j.top_losers),
      active: map(j.most_actively_traded),
      lastUpdated: j.last_updated || null,
    }
  })

export const overview = (symbol) =>
  memo(`o:${symbol}`, 24 * 3600_000, async () => {
    const o = await av({ function: 'OVERVIEW', symbol })
    return {
      symbol: o.Symbol || symbol,
      name: o.Name,
      description: o.Description,
      exchange: o.Exchange,
      currency: o.Currency,
      country: o.Country,
      sector: o.Sector,
      industry: o.Industry,
      marketCap: num(o.MarketCapitalization),
      peRatio: num(o.PERatio),
      eps: num(o.EPS),
      dividendYield: num(o.DividendYield),
      beta: num(o.Beta),
      week52High: num(o['52WeekHigh']),
      week52Low: num(o['52WeekLow']),
    }
  })
