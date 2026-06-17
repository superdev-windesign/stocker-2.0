// Thin fetch wrappers around the backend's data endpoints, provider-aware so the same
// dashboard works for Paytm Money and INDmoney (INDstocks). The active provider selects
// the path prefix; Paytm is the default to stay backward-compatible.
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

const PROVIDER_PATHS = {
  paytm: {
    holdings: '/api/holdings',
    orders: '/api/orders',
    positions: '/api/positions',
    funds: '/api/funds',
    profile: '/api/profile',
    priceChart: '/api/price-chart',
    quote: '/api/quote',
  },
  indmoney: {
    holdings: '/api/indmoney/holdings',
    quote: '/api/indmoney/quote',
    priceChart: '/api/indmoney/historical',
    // INDstocks has no direct equivalents for these in our read-only use — omitted.
  },
}

const pathFor = (provider, key) => (PROVIDER_PATHS[provider] || PROVIDER_PATHS.paytm)[key]

async function get(path, params) {
  const qs = params ? `?${new URLSearchParams(params)}` : ''
  const res = await fetch(`${BACKEND_URL}${path}${qs}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return body
}

// For endpoints a provider doesn't support, resolve to an empty value instead of erroring.
const optional = (path, empty) => (path ? get(path) : Promise.resolve(empty))

export const fetchHoldings = (provider = 'paytm') => get(pathFor(provider, 'holdings'))
export const fetchOrders = (provider = 'paytm') => optional(pathFor(provider, 'orders'), [])
export const fetchPositions = (provider = 'paytm') => optional(pathFor(provider, 'positions'), [])
export const fetchFunds = (provider = 'paytm') => optional(pathFor(provider, 'funds'), null)
export const fetchProfile = (provider = 'paytm') => optional(pathFor(provider, 'profile'), null)
export const fetchPriceChart = (params, provider = 'paytm') => get(pathFor(provider, 'priceChart'), params)
export const fetchQuote = (params, provider = 'paytm') => get(pathFor(provider, 'quote'), params)
