// Normalizes Paytm's holdings payload (field names vary) into a stable shape the
// UI consumes, enriched with bundled sector data.
import { enrich } from '../data/sectors'

const num = (...vals) => {
  for (const v of vals) {
    if (v == null || v === '') continue
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

const str = (...vals) => {
  for (const v of vals) if (v != null && v !== '') return String(v)
  return null
}

// Normalize Paytm's mcap_type ("Small Cap"/"Mid Cap"/"Large Cap") to the bundled
// dataset's buckets ("Small"/"Mid"/"Large") so both sources group together.
const mapCap = (mcapType) => {
  if (!mcapType) return null
  const t = String(mcapType).toLowerCase()
  if (t.includes('large')) return 'Large'
  if (t.includes('mid')) return 'Mid'
  if (t.includes('small')) return 'Small'
  if (t.includes('micro')) return 'Micro'
  return null
}

/**
 * @param {object} apiResponse  body of GET /api/holdings ({ holdings, value })
 * @returns {Array<object>} normalized holdings
 */
export function normalizeHoldings(apiResponse) {
  // Paytm nests the array at holdings.data.results; the other shapes are kept as
  // fallbacks for safety. Note holdings.data is an OBJECT ({ results: [...] }),
  // so it must come AFTER the .results lookups, not before.
  const raw =
    apiResponse?.holdings?.data?.results ||
    apiResponse?.holdings?.results ||
    apiResponse?.holdings?.data ||
    apiResponse?.holdings?.holdings ||
    apiResponse?.data?.results ||
    apiResponse?.data ||
    (Array.isArray(apiResponse?.holdings) ? apiResponse.holdings : []) ||
    []

  if (!Array.isArray(raw)) return []

  return raw
    .map((h) => {
      const symbol = str(h.nse_symbol, h.bse_symbol, h.symbol, h.tradingsymbol, h.display_name)
      const quantity = num(h.quantity, h.qty, h.total_qty, h.net_qty) ?? 0
      const avgPrice = num(h.cost_price, h.avg_price, h.average_price, h.buy_avg_price, h.cost) ?? 0
      const lastPrice = num(h.ltp, h.last_price, h.last_traded_price, h.close_price) ?? 0
      const prevClose = num(h.pc, h.close_price, h.previous_close, h.prev_close, h.pdc)
      const invested = quantity * avgPrice
      const currentValue = quantity * lastPrice
      const pnl = num(h.pnl, h.unrealized_pnl) ?? currentValue - invested
      const pnlPct = invested ? (pnl / invested) * 100 : null

      let dayChangeAbs = null
      let dayChangePct = null
      if (prevClose && lastPrice) {
        dayChangeAbs = (lastPrice - prevClose) * quantity
        dayChangePct = ((lastPrice - prevClose) / prevClose) * 100
      }

      // Prefer the sector / market-cap the API returns (covers small/mid caps the
      // bundled dataset doesn't), falling back to the bundled enrichment by symbol.
      const meta = enrich(symbol)
      const apiExchange = str(h.exchange, h.exchange_segment)
      return {
        securityId: str(h.nse_security_id, h.security_id, h.securityId, h.bse_security_id, h.token, h.instrument_token),
        symbol: symbol || '—',
        name: str(h.display_name, h.name, h.company_name) || symbol || '—',
        // Paytm returns "ALL" for dual-listed scrips; we trade/chart on NSE.
        exchange: !apiExchange || apiExchange === 'ALL' ? 'NSE' : apiExchange,
        isin: str(h.isin, h.isin_code),
        instrument: str(h.instrument, h.product) || 'EQUITY',
        quantity,
        avgPrice,
        lastPrice,
        prevClose,
        invested,
        currentValue,
        pnl,
        pnlPct,
        dayChangeAbs,
        dayChangePct,
        sector: str(h.sector) || meta.sector,
        industry: meta.industry,
        cap: mapCap(h.mcap_type) || meta.cap,
        currency: 'INR',
        country: 'IN',
      }
    })
    .filter((h) => h.quantity > 0)
}

// ── INDstocks (INDmoney) holdings ─────────────────────────────────────────────
// The exact response shape isn't documented in the skill, so this maps a range of
// likely field names (mirroring the defensive approach above). Verify against a real
// response from https://api-docs.indstocks.com once reachable on the deployed backend.
export function normalizeIndmoneyHoldings(apiResponse) {
  const raw =
    apiResponse?.data?.holdings ||
    apiResponse?.holdings?.data ||
    apiResponse?.holdings ||
    apiResponse?.data?.results ||
    apiResponse?.results ||
    apiResponse?.data ||
    (Array.isArray(apiResponse) ? apiResponse : []) ||
    []

  if (!Array.isArray(raw)) return []

  return raw
    .map((h) => {
      const symbol = str(h.symbol, h.tradingsymbol, h.ticker, h.scrip, h.instrument, h.trading_symbol)
      const quantity = num(h.quantity, h.qty, h.units, h.shares, h.net_quantity) ?? 0
      const avgPrice = num(h.avg_price, h.average_price, h.avg_cost, h.buy_avg_price, h.cost_price, h.avg) ?? 0
      const lastPrice = num(h.ltp, h.last_price, h.current_price, h.market_price, h.close_price, h.last_traded_price) ?? 0
      const prevClose = num(h.prev_close, h.previous_close, h.pc, h.close)
      const exchange = (str(h.exchange, h.exchange_segment, h.exch) || 'NSE').toUpperCase()
      const isUS = /nasdaq|nyse|us|arca|bats/i.test(exchange)
      const country = isUS ? 'US' : 'IN'
      const currency = isUS ? 'USD' : 'INR'
      const invested = quantity * avgPrice
      const currentValue = quantity * lastPrice
      const pnl = num(h.pnl, h.unrealized_pnl) ?? currentValue - invested
      const pnlPct = invested ? (pnl / invested) * 100 : null
      let dayChangeAbs = null
      let dayChangePct = null
      if (prevClose && lastPrice) {
        dayChangeAbs = (lastPrice - prevClose) * quantity
        dayChangePct = ((lastPrice - prevClose) / prevClose) * 100
      }
      const meta = country === 'IN' ? enrich(symbol) : { sector: null, industry: null, cap: null }
      return {
        securityId: str(h.security_id, h.securityId, h.token, h.instrument_token, h.isin) || symbol,
        symbol: symbol || '—',
        name: str(h.name, h.company_name, h.display_name) || symbol || '—',
        exchange,
        isin: str(h.isin, h.isin_code),
        instrument: 'EQUITY',
        quantity,
        avgPrice,
        lastPrice,
        prevClose,
        invested,
        currentValue,
        pnl,
        pnlPct,
        dayChangeAbs,
        dayChangePct,
        sector: str(h.sector) || meta.sector,
        industry: meta.industry,
        cap: meta.cap,
        currency,
        country,
      }
    })
    .filter((h) => h.quantity > 0)
}

// Dispatch to the right normalizer for the active provider.
export function normalizeHoldingsFor(provider, apiResponse) {
  return provider === 'indmoney'
    ? normalizeIndmoneyHoldings(apiResponse)
    : normalizeHoldings(apiResponse)
}
