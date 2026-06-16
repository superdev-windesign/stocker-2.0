// Per-stock analytics derived from real historical price candles.

const n = (v) => {
  const x = Number(v)
  return Number.isNaN(x) ? null : x
}

/**
 * Normalize Paytm price-chart candles (shape varies) into {time, open, high, low, close, volume}.
 * `time` is UNIX seconds (lightweight-charts compatible).
 */
export function normalizeCandles(raw) {
  const arr = raw?.data || raw?.candles || (Array.isArray(raw) ? raw : [])
  if (!Array.isArray(arr)) return []
  return arr
    .map((c) => {
      if (Array.isArray(c)) {
        // [time, open, high, low, close, volume]
        return { time: toSec(c[0]), open: n(c[1]), high: n(c[2]), low: n(c[3]), close: n(c[4]), volume: n(c[5]) }
      }
      return {
        time: toSec(c.t ?? c.time ?? c.timestamp ?? c.date ?? c.dt),
        open: n(c.o ?? c.open),
        high: n(c.h ?? c.high),
        low: n(c.l ?? c.low),
        close: n(c.c ?? c.close ?? c.ltp),
        volume: n(c.v ?? c.volume),
      }
    })
    .filter((c) => c.time && c.close != null)
    .sort((a, b) => a.time - b.time)
}

function toSec(t) {
  if (t == null) return null
  if (typeof t === 'number') return t > 1e12 ? Math.floor(t / 1000) : Math.floor(t)
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000)
}

export function athAtl(candles) {
  if (!candles.length) return null
  let ath = -Infinity
  let atl = Infinity
  let athDate = null
  let atlDate = null
  for (const c of candles) {
    const hi = c.high ?? c.close
    const lo = c.low ?? c.close
    if (hi > ath) {
      ath = hi
      athDate = c.time
    }
    if (lo < atl) {
      atl = lo
      atlDate = c.time
    }
  }
  return { ath, athDate, atl, atlDate, rangeStart: candles[0].time, rangeEnd: candles[candles.length - 1].time }
}

// Daily log/simple returns from closes.
function returns(candles) {
  const r = []
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close
    const cur = candles[i].close
    if (prev) r.push((cur - prev) / prev)
  }
  return r
}

// Annualized volatility (%) assuming ~252 trading days.
export function volatility(candles) {
  const r = returns(candles)
  if (r.length < 2) return null
  const mean = r.reduce((a, x) => a + x, 0) / r.length
  const variance = r.reduce((a, x) => a + (x - mean) ** 2, 0) / (r.length - 1)
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

// CAGR (%) from first to last close over the elapsed years.
export function cagr(candles) {
  if (candles.length < 2) return null
  const first = candles[0]
  const last = candles[candles.length - 1]
  if (!first.close) return null
  const years = (last.time - first.time) / (365.25 * 24 * 3600)
  if (years <= 0) return null
  return (Math.pow(last.close / first.close, 1 / years) - 1) * 100
}

// Total return (%) across the series.
export function totalReturn(candles) {
  if (candles.length < 2 || !candles[0].close) return null
  return ((candles[candles.length - 1].close - candles[0].close) / candles[0].close) * 100
}

// Maximum peak-to-trough drawdown (%) over the series (negative number).
export function maxDrawdown(candles) {
  if (candles.length < 2) return null
  let peak = -Infinity
  let maxDd = 0
  for (const c of candles) {
    if (c.close > peak) peak = c.close
    if (peak) {
      const dd = (c.close - peak) / peak
      if (dd < maxDd) maxDd = dd
    }
  }
  return maxDd * 100
}

export function stockStats(candles) {
  return {
    athAtl: athAtl(candles),
    volatility: volatility(candles),
    cagr: cagr(candles),
    totalReturn: totalReturn(candles),
    maxDrawdown: maxDrawdown(candles),
    lastClose: candles.length ? candles[candles.length - 1].close : null,
  }
}
