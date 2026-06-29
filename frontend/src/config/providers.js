// Broker/provider registry. The login screen lets the user pick their trading
// platform; the chosen provider drives which backend auth flow + markets apply.
// Paytm Money is fully wired today. INDmoney (US + Indian stocks) is gated behind
// VITE_INDMONEY_ENABLED until its backend credentials/API are configured, so the
// option is visible but won't present a dead "connect" path before it works.

const indmoneyEnabled = String(import.meta.env.VITE_INDMONEY_ENABLED || '') === 'true'

export const PROVIDERS = {
  paytm: {
    id: 'paytm',
    name: 'Paytm Money',
    markets: 'Indian stocks (NSE/BSE)',
    flag: '🇮🇳',
    available: true,
    auth: 'redirect', // backend redirect login flow
    loginPath: '/api/login',
    tokenRetrievePath: '/api/token/retrieve',
  },
  indmoney: {
    id: 'indmoney',
    name: 'INDmoney',
    markets: 'US + Indian stocks',
    flag: '🇺🇸🇮🇳',
    available: indmoneyEnabled,
    auth: 'token', // log in on INDstocks, paste the issued token (stored server-side)
    exchangePath: '/api/indmoney/exchange',
    tokenRetrievePath: '/api/indmoney/token/retrieve',
  },
  alphavantage: {
    id: 'alphavantage',
    name: 'AlphaVantage',
    markets: 'Explore global markets & research (no broker login)',
    flag: '📈',
    available: true,
    auth: 'explore', // no account — enters market-data explore mode
  },
  csv: {
    id: 'csv',
    name: 'Upload CSV',
    markets: 'Any broker — Zerodha · Paytm · Groww · Upstox',
    flag: '📂',
    available: true,
    auth: 'csv', // no broker token; holdings derived from uploaded tradebook
  },
}

export const PROVIDER_LIST = Object.values(PROVIDERS)
export const DEFAULT_PROVIDER = 'paytm'
export const getProvider = (id) => PROVIDERS[id] || PROVIDERS[DEFAULT_PROVIDER]
