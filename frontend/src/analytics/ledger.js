// Ledger analytics — turns a flat list of buy/sell transactions into the complete
// "journey" of a stock: realized/unrealized P&L (FIFO), averages, extremes, dates,
// holding duration and current status. This is the engine behind F1–F3, F7, F8.

const day = 86400000

// Sort a stock's transactions chronologically (date, then insertion order).
const chrono = (txns) =>
  [...txns].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1
  })

/**
 * Build the full journey for ONE stock from its transactions.
 * Realized P&L uses FIFO lot-matching (the Indian-equity convention).
 *
 * @param {Array} txns        transactions for a single symbol
 * @param {object} ctx        { lastPrice, name, securityId, exchange, sector }
 * @returns {object} journey
 */
export function buildJourney(txns, ctx = {}) {
  const list = chrono(txns)
  const lots = [] // open FIFO buy lots: { qty, price, date }

  let totalBoughtQty = 0
  let totalSoldQty = 0
  let buyValue = 0 // Σ buy qty×price  (gross invested over lifetime)
  let sellValue = 0 // Σ sell qty×price (gross exit value)
  let realizedPnl = 0
  let timesBought = 0
  let timesSold = 0

  let firstBuyDate = null
  let lastBuyDate = null
  let firstSellDate = null
  let lastSellDate = null
  let lastSellPrice = null

  let highestBuy = null
  let lowestBuy = null
  let highestSell = null
  let lowestSell = null

  for (const t of list) {
    if (t.type === 'BUY') {
      lots.push({ qty: t.quantity, price: t.price, date: t.date })
      totalBoughtQty += t.quantity
      buyValue += t.quantity * t.price
      timesBought += 1
      firstBuyDate = firstBuyDate || t.date
      lastBuyDate = t.date
      highestBuy = highestBuy == null ? t.price : Math.max(highestBuy, t.price)
      lowestBuy = lowestBuy == null ? t.price : Math.min(lowestBuy, t.price)
    } else {
      // SELL: match against oldest open lots first (FIFO).
      let remaining = t.quantity
      while (remaining > 0 && lots.length) {
        const lot = lots[0]
        const matched = Math.min(remaining, lot.qty)
        realizedPnl += (t.price - lot.price) * matched
        lot.qty -= matched
        remaining -= matched
        if (lot.qty <= 1e-9) lots.shift()
      }
      // remaining > 0 means selling more than held (short / data gap) — count it
      // at zero cost basis so totals still reconcile.
      if (remaining > 0) realizedPnl += t.price * remaining
      totalSoldQty += t.quantity
      sellValue += t.quantity * t.price
      timesSold += 1
      firstSellDate = firstSellDate || t.date
      lastSellDate = t.date
      lastSellPrice = t.price
      highestSell = highestSell == null ? t.price : Math.max(highestSell, t.price)
      lowestSell = lowestSell == null ? t.price : Math.min(lowestSell, t.price)
    }
  }

  // Remaining open lots = current holding.
  const currentQty = lots.reduce((s, l) => s + l.qty, 0)
  const openCost = lots.reduce((s, l) => s + l.qty * l.price, 0)
  const avgBuyRemaining = currentQty > 0 ? openCost / currentQty : null

  const avgBuyAll = totalBoughtQty > 0 ? buyValue / totalBoughtQty : null
  const avgSellAll = totalSoldQty > 0 ? sellValue / totalSoldQty : null

  const lastPrice = ctx.lastPrice != null ? Number(ctx.lastPrice) : null
  const currentValue = lastPrice != null ? currentQty * lastPrice : null
  const unrealizedPnl =
    lastPrice != null && currentQty > 0 ? (lastPrice - avgBuyRemaining) * currentQty : currentQty > 0 ? null : 0

  const status = currentQty > 1e-9 ? 'HOLDING' : totalBoughtQty > 0 ? 'EXITED' : 'NONE'

  // Holding duration: first buy → (last sell if fully exited, else today).
  let holdingDays = null
  if (firstBuyDate) {
    const end = status === 'EXITED' && lastSellDate ? new Date(lastSellDate) : new Date()
    holdingDays = Math.max(0, Math.round((end - new Date(firstBuyDate)) / day))
  }

  // Total return %: lifetime P&L (realized + unrealized) over gross invested.
  const totalPnl = realizedPnl + (unrealizedPnl || 0)
  const totalReturnPct = buyValue > 0 ? (totalPnl / buyValue) * 100 : null

  return {
    symbol: ctx.symbol || list[0]?.symbol || '—',
    name: ctx.name || list[0]?.name || ctx.symbol || '—',
    securityId: ctx.securityId ?? list[0]?.securityId ?? null,
    exchange: ctx.exchange || list[0]?.exchange || 'NSE',
    currency: ctx.currency || list[0]?.currency || 'INR',
    country: ctx.country || list[0]?.country || 'IN',
    sector: ctx.sector || null,
    status, // HOLDING | EXITED | NONE
    txnCount: list.length,
    transactions: list,

    firstBuyDate,
    lastBuyDate,
    firstSellDate,
    lastSellDate,
    timesBought,
    timesSold,

    totalBoughtQty,
    totalSoldQty,
    currentQty,

    totalInvestment: buyValue,
    totalExitValue: sellValue,
    openCost,
    currentValue,

    avgBuyPrice: avgBuyRemaining ?? avgBuyAll, // remaining lots if holding, else lifetime avg
    avgBuyAll,
    avgSellPrice: avgSellAll,
    highestBuy,
    lowestBuy,
    highestSell,
    lowestSell,

    lastPrice,
    lastSellPrice,

    realizedPnl,
    unrealizedPnl,
    totalPnl,
    totalReturnPct,
    holdingDays,
  }
}

/**
 * Build journeys for ALL stocks from the full ledger, enriched with live prices
 * from current holdings. Returns one journey per distinct symbol.
 *
 * @param {Array} transactions  full ledger
 * @param {Array} holdings      normalized holdings (for lastPrice / name / sector)
 */
export function buildAllJourneys(transactions, holdings = [], priceMap = {}) {
  const bySymbol = new Map()
  for (const t of transactions || []) {
    const key = t.symbol
    if (!bySymbol.has(key)) bySymbol.set(key, [])
    bySymbol.get(key).push(t)
  }

  const holdingBySymbol = new Map(holdings.map((h) => [String(h.symbol).toUpperCase(), h]))

  const journeys = []
  for (const [symbol, txns] of bySymbol) {
    const upper = String(symbol).toUpperCase()
    const h = holdingBySymbol.get(upper)
    // Live price: current holding's LTP, else a fallback price map (exited stocks).
    const lastPrice = h?.lastPrice ?? priceMap[upper] ?? priceMap[symbol] ?? null
    journeys.push(
      buildJourney(txns, {
        symbol,
        name: h?.name,
        securityId: h?.securityId ?? txns.find((t) => t.securityId)?.securityId ?? null,
        exchange: h?.exchange,
        currency: h?.currency ?? txns.find((t) => t.currency)?.currency,
        country: h?.country ?? txns.find((t) => t.country)?.country,
        sector: h?.sector,
        lastPrice,
      }),
    )
  }
  return journeys
}

// Suggested re-entry zone for an exited stock: a band a little below the last exit.
export function reentryZone(lastSellPrice) {
  if (lastSellPrice == null) return null
  return { low: lastSellPrice * 0.9, high: lastSellPrice * 0.95 }
}
