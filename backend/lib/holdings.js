// Derives a live holdings list from the user's ledger transactions.
// Computes open positions (weighted avg cost) and enriches with Yahoo Finance quotes.
import { listTransactions } from './ledger.js'
import * as yahoo from './marketdata/yahoo.js'

// Try Yahoo Finance symbol formats: NSE for India, bare for US.
// Falls back through .BO and bare symbol.
async function fetchLiveQuote(symbol, country) {
  const candidates = country === 'IN'
    ? [`${symbol}.NS`, `${symbol}.BO`, symbol]
    : [symbol]

  for (const sym of candidates) {
    try {
      const q = await yahoo.quote(sym)
      if (q?.price != null) {
        console.log(`[holdings] quote ${symbol} (${sym}) = ${q.price}`)
        return q
      }
    } catch (e) {
      console.log(`[holdings] quote ${sym} failed: ${e.message}`)
    }
  }
  console.log(`[holdings] quote ${symbol} → no price found`)
  return null
}

export async function getDerivedHoldings(userId) {
  const txns = await listTransactions(userId)
  console.log(`[holdings] userId=${userId} txns=${txns.length}`)
  if (!txns.length) return []

  // Weighted average cost per symbol — track running qty and cost basis
  const positions = {}
  for (const t of txns) {
    const sym = t.symbol.toUpperCase()
    if (!positions[sym]) {
      positions[sym] = {
        symbol: sym,
        name: t.name || sym,
        exchange: t.exchange || 'NSE',
        currency: t.currency || 'INR',
        country: t.country || 'IN',
        quantity: 0,
        totalCost: 0,
      }
    }
    const p = positions[sym]
    if (t.type === 'BUY') {
      p.totalCost += t.quantity * t.price + (t.charges || 0)
      p.quantity += t.quantity
      // Keep the latest non-null name
      if (t.name && t.name !== sym) p.name = t.name
    } else if (t.type === 'SELL') {
      const avgCost = p.quantity > 0 ? p.totalCost / p.quantity : 0
      const soldCost = Math.min(t.quantity, p.quantity) * avgCost
      p.totalCost = Math.max(0, p.totalCost - soldCost)
      p.quantity = Math.max(0, p.quantity - t.quantity)
    }
  }

  const open = Object.values(positions).filter((p) => p.quantity > 0.001)
  console.log(`[holdings] open positions: ${open.map(p => `${p.symbol}×${Math.round(p.quantity)}`).join(', ')}`)
  if (!open.length) return []

  // Enrich each open position with a live quote (parallel; 60s cache inside yahoo.js)
  const results = await Promise.allSettled(
    open.map(async (p) => {
      const avgPrice = p.totalCost / p.quantity
      const lq = await fetchLiveQuote(p.symbol, p.country)
      const lastPrice = lq?.price ?? 0
      const prevClose = lq?.prevClose ?? null
      const invested = p.quantity * avgPrice
      const currentValue = p.quantity * lastPrice
      const pnl = currentValue - invested
      const pnlPct = invested ? (pnl / invested) * 100 : null

      return {
        symbol: p.symbol,
        name: lq?.name || p.name,
        exchange: p.exchange,
        currency: p.currency,
        country: p.country,
        securityId: null,
        isin: null,
        instrument: 'EQUITY',
        quantity: Math.round(p.quantity * 1000) / 1000,
        avgPrice: Math.round(avgPrice * 100) / 100,
        lastPrice,
        prevClose,
        invested: Math.round(invested * 100) / 100,
        currentValue: Math.round(currentValue * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        pnlPct: pnlPct != null ? Math.round(pnlPct * 100) / 100 : null,
        dayChangeAbs: prevClose && lastPrice
          ? Math.round((lastPrice - prevClose) * p.quantity * 100) / 100
          : null,
        dayChangePct: prevClose
          ? Math.round(((lastPrice - prevClose) / prevClose) * 10000) / 100
          : null,
        sector: null,
        industry: null,
        cap: null,
      }
    }),
  )

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((h) => h.quantity > 0)
}
