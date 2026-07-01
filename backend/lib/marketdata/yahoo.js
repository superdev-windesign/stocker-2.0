// Yahoo Finance provider — used for global market indices and India market data.
// No API key required, but Yahoo Finance now requires a crumb cookie.
// We lazily obtain the crumb and cache it; on 401 we refresh and retry once.

const CHART_BASE = 'https://query2.finance.yahoo.com'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com',
  'Origin': 'https://finance.yahoo.com',
}

import { memo } from '../cache.js'

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))

// ── Cookie + crumb management ─────────────────────────────────────────────────
let _crumbState = { crumb: null, cookie: null, exp: 0 }

async function getCrumb(force = false) {
  if (!force && _crumbState.crumb && _crumbState.exp > Date.now()) {
    return _crumbState
  }
  // Step 1: get consent cookie from Yahoo
  const consentResp = await fetch('https://fc.yahoo.com/', {
    headers: HEADERS,
    redirect: 'follow',
  })
  const setCookie = consentResp.headers.get('set-cookie') || ''
  // Extract just the key=value pairs without attributes (Secure; Path; etc.)
  const cookie = setCookie.split(',').map((c) => c.trim().split(';')[0]).join('; ')

  // Step 2: get the crumb
  const crumbResp = await fetch(`${CHART_BASE}/v1/test/getcrumb`, {
    headers: { ...HEADERS, Cookie: cookie },
  })
  const crumb = await crumbResp.text()
  if (!crumb || crumb.includes('<html') || crumb.length > 20) {
    // Sometimes this fails — try parsing HTML from finance.yahoo.com
    const htmlResp = await fetch('https://finance.yahoo.com/', {
      headers: { ...HEADERS, Cookie: cookie },
    })
    const html = await htmlResp.text()
    const match = html.match(/"crumb":"([^"]+)"/)
    _crumbState = { crumb: match?.[1] || '', cookie, exp: Date.now() + 6 * 3600_000 }
  } else {
    _crumbState = { crumb: crumb.trim(), cookie, exp: Date.now() + 6 * 3600_000 }
  }
  return _crumbState
}

// ── v8/chart quote per symbol ────────────────────────────────────────────────
async function chartQuote(symbol, crumbState) {
  const url = `${CHART_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false&crumb=${encodeURIComponent(crumbState.crumb)}`
  const resp = await fetch(url, {
    headers: { ...HEADERS, Cookie: crumbState.cookie },
  })
  if (resp.status === 401 || resp.status === 403) {
    const e = new Error(`Yahoo Finance auth error ${resp.status}`)
    e.status = resp.status
    throw e
  }
  const j = await resp.json()
  const result = j?.chart?.result?.[0]
  const meta = result?.meta
  if (!meta) {
    const errMsg = j?.chart?.error?.description || `No data for ${symbol}`
    const e = new Error(errMsg)
    e.status = 404
    throw e
  }
  // Attach first candle's open as fallback for when regularMarketOpen is absent (after-hours)
  const firstOpen = result?.indicators?.quote?.[0]?.open?.find((v) => v != null)
  if (firstOpen != null && meta.regularMarketOpen == null) {
    meta._firstCandleOpen = firstOpen
  }
  return meta
}

async function fetchWithCrumb(symbol) {
  let state = await getCrumb()
  try {
    return await chartQuote(symbol, state)
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      // Refresh crumb once and retry.
      state = await getCrumb(true)
      return await chartQuote(symbol, state)
    }
    throw err
  }
}

function metaToQuote(meta, symbol) {
  const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? null
  const price = meta.regularMarketPrice ?? null
  const change = price != null && prevClose != null ? price - prevClose : null
  const changePct = price != null && prevClose ? ((price - prevClose) / prevClose) * 100 : null
  return {
    symbol:    meta.symbol || symbol,
    name:      meta.longName || meta.shortName || meta.symbol || symbol,
    price:     num(price),
    prevClose: num(prevClose),
    change:    change != null ? Math.round(change * 100) / 100 : null,
    changePct: changePct != null ? Math.round(changePct * 1000) / 1000 : null,
    open:      num(meta.regularMarketOpen ?? meta._firstCandleOpen),
    high:      num(meta.regularMarketDayHigh),
    low:       num(meta.regularMarketDayLow),
    volume:    num(meta.regularMarketVolume),
    week52High: num(meta.fiftyTwoWeekHigh),
    week52Low:  num(meta.fiftyTwoWeekLow),
    currency:  meta.currency || 'USD',
    exchange:  meta.fullExchangeName || meta.exchangeName || null,
    marketState: meta.marketState || null,
  }
}

// ── Major global indices ──────────────────────────────────────────────────────
const INDEX_SYMBOLS = ['^NSEI', '^BSESN', '^NSEBANK', '^CNXIT', '^GSPC', '^IXIC', '^DJI']
const INDEX_META = {
  '^NSEI':    { label: 'Nifty 50',   region: 'IN' },
  '^BSESN':   { label: 'Sensex',     region: 'IN' },
  '^NSEBANK': { label: 'Bank Nifty', region: 'IN' },
  '^CNXIT':   { label: 'Nifty IT',   region: 'IN' },
  '^GSPC':    { label: 'S&P 500',    region: 'US' },
  '^IXIC':    { label: 'Nasdaq',     region: 'US' },
  '^DJI':     { label: 'Dow Jones',  region: 'US' },
}

export const indices = () =>
  memo('indices', 30_000, async () => {
    const results = await Promise.allSettled(INDEX_SYMBOLS.map((sym) => fetchWithCrumb(sym)))
    return results
      .map((r, i) => {
        const sym = INDEX_SYMBOLS[i]
        if (r.status === 'rejected') {
          console.warn(`[stocker] Yahoo index ${sym}: ${r.reason?.message}`)
          return { symbol: sym, ...INDEX_META[sym], price: null, changePct: null, error: r.reason?.message }
        }
        return { ...metaToQuote(r.value, sym), ...INDEX_META[sym] }
      })
  })

// ── Single quote (for India stocks by Yahoo symbol) ──────────────────────────
export const quote = (symbol) =>
  memo(`yq:${symbol}`, 60_000, async () => {
    const meta = await fetchWithCrumb(symbol)
    return metaToQuote(meta, symbol)
  })

// ── OHLCV chart data (intraday + historical) ─────────────────────────────────
async function doChart(symbol, interval, range, crumbState) {
  const url = `${CHART_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false&crumb=${encodeURIComponent(crumbState.crumb)}`
  const resp = await fetch(url, { headers: { ...HEADERS, Cookie: crumbState.cookie } })
  if (resp.status === 401 || resp.status === 403) {
    const e = new Error(`Yahoo Finance auth error ${resp.status}`)
    e.status = resp.status
    throw e
  }
  const j = await resp.json()
  const result = j?.chart?.result?.[0]
  if (!result) throw new Error(j?.chart?.error?.description || `No chart data for ${symbol}`)
  const ts = result.timestamp || []
  const q = result.indicators?.quote?.[0] || {}
  const candles = ts
    .map((t, i) => ({
      time: t,
      open:   q.open?.[i]   != null ? Math.round(q.open[i] * 100) / 100   : null,
      high:   q.high?.[i]   != null ? Math.round(q.high[i] * 100) / 100   : null,
      low:    q.low?.[i]    != null ? Math.round(q.low[i] * 100) / 100    : null,
      close:  q.close?.[i]  != null ? Math.round(q.close[i] * 100) / 100  : null,
      volume: q.volume?.[i] ?? null,
    }))
    .filter((c) => c.close != null)
  return {
    candles,
    meta: {
      symbol:     result.meta.symbol,
      currency:   result.meta.currency || 'INR',
      prevClose:  result.meta.previousClose || result.meta.chartPreviousClose || null,
      marketPrice:result.meta.regularMarketPrice || null,
    },
  }
}

export const chart = (symbol, interval = '5m', range = '1d') => {
  const ttl = ['5m', '15m', '30m', '1h'].includes(interval) ? 60_000 : 300_000
  return memo(`yc:${symbol}:${interval}:${range}`, ttl, async () => {
    let state = await getCrumb()
    try { return await doChart(symbol, interval, range, state) }
    catch (err) {
      if (err.status === 401 || err.status === 403) {
        state = await getCrumb(true)
        return await doChart(symbol, interval, range, state)
      }
      throw err
    }
  })
}

// ── Fundamentals via Yahoo quoteSummary (market cap, P/E, EPS, div yield, beta) ──
async function doQuoteSummary(symbol, crumbState) {
  const modules = 'summaryDetail,defaultKeyStatistics,assetProfile,price'
  const url = `${CHART_BASE}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(crumbState.crumb)}`
  const resp = await fetch(url, { headers: { ...HEADERS, Cookie: crumbState.cookie } })
  if (resp.status === 401 || resp.status === 403) {
    const e = new Error(`Yahoo quoteSummary auth ${resp.status}`); e.status = resp.status; throw e
  }
  const j = await resp.json()
  const r = j?.quoteSummary?.result?.[0]
  if (!r) throw new Error(`No fundamentals for ${symbol}`)
  const sd = r.summaryDetail || {}, ks = r.defaultKeyStatistics || {}, ap = r.assetProfile || {}, pr = r.price || {}
  const raw = (o) => (o && typeof o === 'object' ? (o.raw ?? null) : (o ?? null))
  return {
    marketCap:     raw(sd.marketCap) ?? raw(pr.marketCap),
    peRatio:       raw(sd.trailingPE) ?? raw(ks.forwardPE),
    forwardPE:     raw(ks.forwardPE),
    eps:           raw(ks.trailingEps),
    dividendYield: raw(sd.dividendYield),   // fraction (0.012 = 1.2%)
    beta:          raw(sd.beta) ?? raw(ks.beta),
    priceToBook:   raw(ks.priceToBook),
    sector:        ap.sector ?? null,
    industry:      ap.industry ?? null,
    currency:      pr.currency ?? sd.currency ?? null,
  }
}

export const fundamentals = (symbol) =>
  memo(`yfund:${symbol}`, 3600_000, async () => {
    let state = await getCrumb()
    try { return await doQuoteSummary(symbol, state) }
    catch (err) {
      if (err.status === 401 || err.status === 403) {
        state = await getCrumb(true)
        return await doQuoteSummary(symbol, state)
      }
      throw err
    }
  })

// ── Stock/index news via Yahoo search ─────────────────────────────────────────
async function doSearch(query, crumbState) {
  const url = `${CHART_BASE}/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=12&quotesCount=0&crumb=${encodeURIComponent(crumbState.crumb)}`
  const resp = await fetch(url, { headers: { ...HEADERS, Cookie: crumbState.cookie } })
  if (resp.status === 401 || resp.status === 403) {
    const e = new Error(`Yahoo search auth ${resp.status}`); e.status = resp.status; throw e
  }
  const j = await resp.json()
  return (j?.news || [])
    .filter((n) => n.title && n.link)
    .map((n) => ({
      title: n.title,
      publisher: n.publisher || 'News',
      link: n.link,
      publishedAt: n.providerPublishTime ? n.providerPublishTime * 1000 : null,
      thumbnail: n.thumbnail?.resolutions?.slice(-1)?.[0]?.url || null,
    }))
}

export const news = (query) =>
  memo(`ynews:${query}`, 5 * 60_000, async () => {
    let state = await getCrumb()
    try { return await doSearch(query, state) }
    catch (err) {
      if (err.status === 401 || err.status === 403) {
        state = await getCrumb(true)
        return await doSearch(query, state)
      }
      throw err
    }
  })

// ── Nifty sector indices ──────────────────────────────────────────────────────
const SECTOR_SYMS = [
  '^CNXAUTO', '^CNXFIN', '^CNXFMCG', '^CNXINFRA',
  '^CNXIT',   '^CNXMEDIA', '^CNXMETAL', '^CNXPHARMA', '^CNXREALTY',
]
const SECTOR_META = {
  '^CNXAUTO':   { label: 'NIFTY AUTO',    sector: 'Auto' },
  '^CNXFIN':    { label: 'NIFTY FIN SER', sector: 'Financials' },
  '^CNXFMCG':   { label: 'NIFTY FMCG',   sector: 'Consumer Staples' },
  '^CNXINFRA':  { label: 'NIFTY INFRA',   sector: 'Industrials' },
  '^CNXIT':     { label: 'NIFTY IT',      sector: 'Information Tech' },
  '^CNXMEDIA':  { label: 'NIFTY MEDIA',   sector: 'Communication' },
  '^CNXMETAL':  { label: 'NIFTY METAL',   sector: 'Materials' },
  '^CNXPHARMA': { label: 'NIFTY PHARMA',  sector: 'Health Care' },
  '^CNXREALTY': { label: 'NIFTY REALTY',  sector: 'Real Estate' },
}
// US sector SPDR ETFs (proxy for US equity sectors)
const US_SECTOR_SYMS = ['XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC']
const US_SECTOR_META = {
  XLK:  { label: 'Technology',        sector: 'Information Tech' },
  XLF:  { label: 'Financials',        sector: 'Financials' },
  XLE:  { label: 'Energy',            sector: 'Energy' },
  XLV:  { label: 'Health Care',       sector: 'Health Care' },
  XLY:  { label: 'Consumer Disc.',    sector: 'Consumer Disc.' },
  XLP:  { label: 'Consumer Staples',  sector: 'Consumer Staples' },
  XLI:  { label: 'Industrials',       sector: 'Industrials' },
  XLB:  { label: 'Materials',         sector: 'Materials' },
  XLU:  { label: 'Utilities',         sector: 'Utilities' },
  XLRE: { label: 'Real Estate',       sector: 'Real Estate' },
  XLC:  { label: 'Communication',     sector: 'Communication' },
}

export const sectorIndices = (region = 'IN') =>
  memo(`sector-indices:${region}`, 30_000, async () => {
    const syms = region === 'US' ? US_SECTOR_SYMS : SECTOR_SYMS
    const meta = region === 'US' ? US_SECTOR_META : SECTOR_META
    const results = await Promise.allSettled(syms.map((s) => fetchWithCrumb(s)))
    return results
      .map((r, i) => {
        const sym = syms[i]
        if (r.status === 'rejected') return null
        return { ...metaToQuote(r.value, sym), ...meta[sym], region, yahooSymbol: sym }
      })
      .filter(Boolean)
  })

// US most-active / gainers / losers via Yahoo (so US region doesn't burn AlphaVantage quota).
const US_UNIVERSE = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'JPM', 'V',
  'WMT', 'MA', 'XOM', 'UNH', 'ORCL', 'HD', 'PG', 'COST', 'JNJ', 'BAC',
  'NFLX', 'AMD', 'CRM', 'KO', 'CVX', 'PEP', 'INTC', 'DIS', 'CSCO', 'MCD',
  'ABBV', 'WFC', 'IBM', 'GE', 'QCOM', 'BA', 'PYPL', 'UBER', 'F', 'T',
]
export const usQuotes = () =>
  memo('us-quotes', 60_000, async () => {
    const results = await Promise.allSettled(US_UNIVERSE.map((s) => quote(s).then((q) => ({ ...q, nsSymbol: s }))))
    return results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  })

// ── Stock split history ──────────────────────────────────────────────────────
async function doSplits(symbol, crumbState) {
  const url = `${CHART_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=max&events=split&crumb=${encodeURIComponent(crumbState.crumb)}`
  const resp = await fetch(url, { headers: { ...HEADERS, Cookie: crumbState.cookie } })
  if (resp.status === 401 || resp.status === 403) {
    const e = new Error(`Yahoo Finance auth error ${resp.status}`); e.status = resp.status; throw e
  }
  const j = await resp.json()
  const result = j?.chart?.result?.[0]
  if (!result) return []
  const splitEvents = result.events?.splits || {}
  return Object.values(splitEvents)
    .map((s) => ({
      date: new Date(s.date * 1000).toISOString().slice(0, 10),
      ratio: s.numerator / s.denominator,   // e.g. 10 for a 10:1 split
      label: `${s.numerator}:${s.denominator}`,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const splits = (symbol) =>
  memo(`ysplits:${symbol}`, 24 * 3600_000, async () => {
    let state = await getCrumb()
    try { return await doSplits(symbol, state) }
    catch (err) {
      if (err.status === 401 || err.status === 403) {
        state = await getCrumb(true)
        return await doSplits(symbol, state)
      }
      throw err
    }
  })

// ── Sentiment derived from index performance ─────────────────────────────────
export const sentiment = () =>
  memo('sentiment', 30_000, async () => {
    let data
    try { data = await indices() } catch { return { label: 'Unknown', score: 0 } }
    const valid  = data.filter((d) => d.changePct != null)
    const scores = valid.map((d) => d.changePct)
    if (!scores.length) return { label: 'Unknown', score: 0 }
    const avg  = scores.reduce((a, b) => a + b, 0) / scores.length
    const up   = scores.filter((s) => s > 0.3).length
    const down = scores.filter((s) => s < -0.3).length
    const label = up >= Math.ceil(valid.length * 0.6) ? 'Bullish'
                : down >= Math.ceil(valid.length * 0.6) ? 'Bearish'
                : 'Neutral'
    return {
      label,
      score: Math.round(avg * 100) / 100,
      details: { upCount: up, downCount: down, avgChangePct: Math.round(avg * 100) / 100 },
    }
  })
