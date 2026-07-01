// Reconstructs a daily portfolio equity curve from the user's ledger + Yahoo historical
// prices. Gives an instant, real value/invested history (no waiting for EOD snapshots).
import { listTransactions } from './ledger.js'
import * as yahoo from './marketdata/yahoo.js'
import { syncSplits, getSplitsForSymbols, applySplitAdjustments } from './corporateActions.js'

const ymd = (sec) => new Date(sec * 1000).toISOString().slice(0, 10)

// requested range → Yahoo (interval, range). Daily up to ~2y, weekly/monthly beyond.
const RANGE = {
  '1mo': { interval: '1d', range: '1mo' },
  '3mo': { interval: '1d', range: '3mo' },
  '6mo': { interval: '1d', range: '6mo' },
  'ytd': { interval: '1d', range: 'ytd' },
  '1y':  { interval: '1d', range: '1y'  },
  '2y':  { interval: '1wk', range: '2y' },
  'max': { interval: '1wk', range: 'max' },
}

import { memo } from './cache.js'

export function getPortfolioHistory(userId, range = '1y', country = null) {
  const cfg = RANGE[range] || RANGE['1y']
  const ckey = `phist:${userId}:${range}${country ? `:${country}` : ''}`
  return memo(ckey, 10 * 60_000, async () => {
    let txns = await listTransactions(userId)
    if (country) txns = txns.filter((t) => (t.country || 'IN') === country)
    if (!txns.length) return { series: [], currency: country === 'US' ? 'USD' : 'INR' }

    // Phase 6: apply split adjustments so historical cost-basis aligns with Yahoo adjusted prices.
    const allSymbols = [...new Set(txns.map((t) => t.symbol.toUpperCase()))]
    await Promise.allSettled(
      allSymbols.map((sym) => {
        const c = txns.find((t) => t.symbol.toUpperCase() === sym)?.country || 'IN'
        return syncSplits(sym, c === 'IN' ? `${sym}.NS` : sym)
      }),
    )
    const splitsMap = await getSplitsForSymbols(allSymbols)
    txns = applySplitAdjustments(txns, splitsMap)

    txns.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    const firstDate = txns[0].date
    const currency = txns[0].currency || 'INR'

    // Distinct symbols + their market (for the Yahoo suffix)
    const meta = {}
    for (const t of txns) {
      const sym = t.symbol.toUpperCase()
      if (!meta[sym]) meta[sym] = { country: t.country || 'IN' }
    }
    const symbols = Object.keys(meta)

    // Fetch daily closes per symbol → { sym: { 'YYYY-MM-DD': close } }
    const priceMap = {}
    await Promise.allSettled(
      symbols.map(async (sym) => {
        const ysym = meta[sym].country === 'IN' ? `${sym}.NS` : sym
        try {
          const ch = await yahoo.chart(ysym, cfg.interval, cfg.range)
          const m = {}
          for (const c of ch.candles) if (c.close != null) m[ymd(c.time)] = c.close
          priceMap[sym] = m
        } catch { priceMap[sym] = {} }
      }),
    )

    // Union of all trading days within range and on/after the first trade
    const dateSet = new Set()
    for (const sym of symbols) for (const d of Object.keys(priceMap[sym] || {})) dateSet.add(d)
    const dates = [...dateSet].sort().filter((d) => d >= firstDate)
    if (!dates.length) return { series: [], currency }

    // Walk dates, applying ledger txns up to each date (weighted-avg cost like holdings.js)
    const pos = {}              // sym -> { qty, cost }
    const lastClose = {}        // carry-forward last known close per symbol
    let ti = 0
    const series = []
    for (const date of dates) {
      while (ti < txns.length && txns[ti].date <= date) {
        const t = txns[ti]; const sym = t.symbol.toUpperCase()
        const p = pos[sym] || (pos[sym] = { qty: 0, cost: 0 })
        if (t.type === 'BUY') {
          p.cost += t.quantity * t.price + (t.charges || 0)
          p.qty += t.quantity
        } else {
          const avg = p.qty > 0 ? p.cost / p.qty : 0
          const sold = Math.min(t.quantity, p.qty)
          p.cost = Math.max(0, p.cost - sold * avg)
          p.qty = Math.max(0, p.qty - t.quantity)
        }
        ti++
      }
      let value = 0, invested = 0
      for (const sym of Object.keys(pos)) {
        const q = pos[sym].qty
        if (q <= 0.0001) continue
        const cl = priceMap[sym]?.[date] ?? lastClose[sym]
        if (cl != null) { lastClose[sym] = cl; value += q * cl }
        invested += pos[sym].cost
      }
      series.push({
        date,
        value: Math.round(value * 100) / 100,
        invested: Math.round(invested * 100) / 100,
      })
    }
    return { series, currency }
  })
}
