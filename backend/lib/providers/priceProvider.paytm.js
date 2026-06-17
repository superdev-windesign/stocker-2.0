// PriceProvider adapter over Paytm's live-price API. Used by the scheduler to fetch
// quotes for alert evaluation. Deploy-only (calls Paytm). Response field mapping is
// defensive; verify against the live /data/v1/price/live shape on the deployed backend.
import { paytmGet } from '../paytm.js'

export const id = 'paytm'

const num = (...v) => {
  for (const x of v) {
    if (x == null || x === '') continue
    const n = Number(x)
    if (!Number.isNaN(n)) return n
  }
  return null
}

/**
 * @param {Array} items  [{ symbol, securityId, exchange }]
 * @returns {object} { SYMBOL: { last, changePct, high52, low52 } }
 */
export async function getQuotes(items = []) {
  const out = {}
  for (const it of items) {
    try {
      const r = await paytmGet('/data/v1/price/live', {
        mode: 'LTP',
        pref: `${it.exchange || 'NSE'}:${it.securityId}:EQUITY`,
      })
      const d = r?.data?.[0] || (Array.isArray(r?.data) ? r.data[0] : r?.data) || r || {}
      out[String(it.symbol).toUpperCase()] = {
        last: num(d.last_price, d.ltp, d.close_price),
        changePct: num(d.change_percent, d.changePercent, d.net_change_percent),
        high52: num(d.week_52_high, d.year_high, d.high_52, d['52_week_high']),
        low52: num(d.week_52_low, d.year_low, d.low_52, d['52_week_low']),
      }
    } catch {
      /* skip this symbol on error */
    }
  }
  return out
}
