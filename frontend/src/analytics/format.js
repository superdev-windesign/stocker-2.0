// Formatting helpers shared across the dashboard.

export const inr = (n, opts = {}) =>
  n == null || Number.isNaN(Number(n))
    ? '—'
    : Number(n).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        ...opts,
      })

// Compact ₹ for big sums: ₹1.2L, ₹3.4Cr
export const inrCompact = (n) => {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  const abs = Math.abs(v)
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(2)}K`
  return `₹${v.toFixed(2)}`
}

// Currency-aware amount formatter (₹ for INR, $ for USD, etc.) for mixed India/US
// portfolios. Components that show per-stock amounts can use this with holding.currency.
const CURRENCY_SYMBOL = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }
export const money = (n, currency = 'INR', opts = {}) => {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const sym = CURRENCY_SYMBOL[currency] || ''
  const locale = currency === 'INR' ? 'en-IN' : 'en-US'
  return `${sym}${Number(n).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, ...opts })}`
}

// Compact currency formatter — Indian L/Cr for INR, K/M/B otherwise.
export const moneyCompact = (n, currency = 'INR') => {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  const abs = Math.abs(v)
  const sym = CURRENCY_SYMBOL[currency] || ''
  if (currency === 'INR') {
    if (abs >= 1e7) return `${sym}${(v / 1e7).toFixed(2)}Cr`
    if (abs >= 1e5) return `${sym}${(v / 1e5).toFixed(2)}L`
    if (abs >= 1e3) return `${sym}${(v / 1e3).toFixed(2)}K`
    return `${sym}${v.toFixed(2)}`
  }
  if (abs >= 1e9) return `${sym}${(v / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sym}${(v / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sym}${(v / 1e3).toFixed(2)}K`
  return `${sym}${v.toFixed(2)}`
}

export const pct = (n) =>
  n == null || Number.isNaN(Number(n)) ? '—' : `${Number(n) >= 0 ? '+' : ''}${Number(n).toFixed(2)}%`

export const signClass = (n) =>
  n == null || Number.isNaN(Number(n)) ? 'text-slate-400' : Number(n) >= 0 ? 'text-up' : 'text-down'

export const fmtDate = (d) => {
  if (!d) return '—'
  const date = typeof d === 'number' ? new Date(d * (d < 1e12 ? 1000 : 1)) : new Date(d)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const fmtTime = (d) => {
  if (!d) return '—'
  const date = typeof d === 'number' ? new Date(d * (d < 1e12 ? 1000 : 1)) : new Date(d)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
