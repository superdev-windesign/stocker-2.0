// India equity capital-gains tax analytics, computed from the FIFO lots in each journey.
// ESTIMATES ONLY — not tax advice. Listed equity, STT-paid, post-23-Jul-2024 rules:
//   • Long-term  (held > 12 months): 12.5% on gains above ₹1,25,000 per FY (Sec 112A)
//   • Short-term (held ≤ 12 months): 20% (Sec 111A)
// Financial year runs Apr 1 – Mar 31. US/other-currency holdings are excluded (different regime).
const LT_DAYS = 365
const STCG_RATE = 0.2
const LTCG_RATE = 0.125
const LTCG_EXEMPTION = 125000

export const TAX_RATES = { LT_DAYS, STCG_RATE, LTCG_RATE, LTCG_EXEMPTION }

const days = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000)
const isINR = (j) => (j.currency || 'INR') === 'INR'

export function currentFY(d = new Date()) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return { start: `${y}-04-01`, end: `${y + 1}-03-31`, label: `FY${String(y).slice(2)}-${String(y + 1).slice(2)}` }
}

const inFY = (dateStr, fy) => dateStr >= fy.start && dateStr <= fy.end

// Realized capital gains for a financial year, split into short/long term + tax due.
export function realizedCapitalGains(journeys = [], fy = currentFY()) {
  let stGain = 0
  let ltGain = 0
  const items = []
  for (const j of journeys) {
    if (!isINR(j)) continue
    for (const r of j.realizedLots || []) {
      if (!inFY(r.sellDate, fy)) continue
      const term = days(r.buyDate, r.sellDate) > LT_DAYS ? 'LT' : 'ST'
      if (term === 'LT') ltGain += r.gain
      else stGain += r.gain
      items.push({ symbol: j.symbol, ...r, term })
    }
  }
  const stTax = Math.max(0, stGain) * STCG_RATE
  const ltTaxable = Math.max(0, ltGain - LTCG_EXEMPTION)
  const ltTax = ltTaxable * LTCG_RATE
  return {
    fy,
    stGain,
    ltGain,
    ltExemptionUsed: Math.min(Math.max(ltGain, 0), LTCG_EXEMPTION),
    stTax,
    ltTax,
    totalTax: stTax + ltTax,
    items,
  }
}

// Hypothetical tax if you sold every current holding today (per open lot).
export function unrealizedIfSold(journeys = [], asOf = new Date()) {
  let stGain = 0
  let ltGain = 0
  const lots = []
  for (const j of journeys) {
    if (!isINR(j) || j.lastPrice == null) continue
    for (const l of j.openLots || []) {
      const gain = (j.lastPrice - l.price) * l.qty
      const d = days(l.date, asOf)
      const term = d > LT_DAYS ? 'LT' : 'ST'
      if (term === 'LT') ltGain += gain
      else stGain += gain
      lots.push({ symbol: j.symbol, qty: l.qty, buyPrice: l.price, buyDate: l.date, gain, days: d, term })
    }
  }
  const stTax = Math.max(0, stGain) * STCG_RATE
  const ltTax = Math.max(0, ltGain - LTCG_EXEMPTION) * LTCG_RATE
  return { stGain, ltGain, stTax, ltTax, totalTax: stTax + ltTax, lots }
}

// Open lots about to cross the 1-year mark — "hold N more days to unlock LTCG".
export function ltReadiness(journeys = [], withinDays = 90, asOf = new Date()) {
  const out = []
  for (const j of journeys) {
    if (!isINR(j) || j.lastPrice == null) continue
    for (const l of j.openLots || []) {
      const d = days(l.date, asOf)
      const toLT = LT_DAYS + 1 - d
      if (d <= LT_DAYS && toLT <= withinDays && toLT > 0) {
        const gain = (j.lastPrice - l.price) * l.qty
        const potentialSaving = gain > 0 ? gain * (STCG_RATE - LTCG_RATE) : 0
        out.push({ symbol: j.symbol, securityId: j.securityId, qty: l.qty, buyDate: l.date, daysToLT: toLT, gain, potentialSaving })
      }
    }
  }
  return out.sort((a, b) => b.potentialSaving - a.potentialSaving || a.daysToLT - b.daysToLT)
}

// Holdings sitting at an unrealized loss — sellable to harvest losses that offset gains.
export function harvestCandidates(journeys = []) {
  const out = []
  for (const j of journeys) {
    if (!isINR(j) || j.lastPrice == null || j.currentQty <= 0) continue
    if (j.unrealizedPnl != null && j.unrealizedPnl < 0) {
      out.push({ symbol: j.symbol, securityId: j.securityId, qty: j.currentQty, unrealizedLoss: j.unrealizedPnl })
    }
  }
  return out.sort((a, b) => a.unrealizedLoss - b.unrealizedLoss)
}

// One call for the Tax page: realized gains + harvesting offset suggestion.
export function taxSummary(journeys = []) {
  const realized = realizedCapitalGains(journeys)
  const harvest = harvestCandidates(journeys)
  const harvestableLoss = harvest.reduce((a, h) => a + h.unrealizedLoss, 0) // negative
  const netTaxableGain = realized.stGain + realized.ltGain
  // Loss offsets gains rupee-for-rupee; rough saving uses a blended rate proxy.
  const offset = Math.min(Math.max(netTaxableGain, 0), -harvestableLoss)
  const estSaving = offset * (realized.stGain > 0 ? STCG_RATE : LTCG_RATE)
  return { realized, harvest, harvestableLoss, offset, estSaving, ltReadiness: ltReadiness(journeys) }
}
