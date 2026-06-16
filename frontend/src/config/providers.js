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
    accent: 'indigo',
    available: true,
    // Backend auth/data paths (adapter seam — INDmoney mirrors these once built).
    loginPath: '/api/login',
    tokenRetrievePath: '/api/token/retrieve',
  },
  indmoney: {
    id: 'indmoney',
    name: 'INDmoney',
    markets: 'US + Indian stocks',
    flag: '🇺🇸🇮🇳',
    accent: 'emerald',
    available: indmoneyEnabled,
    loginPath: '/api/indmoney/login',
    tokenRetrievePath: '/api/indmoney/token/retrieve',
  },
}

export const PROVIDER_LIST = Object.values(PROVIDERS)
export const DEFAULT_PROVIDER = 'paytm'
export const getProvider = (id) => PROVIDERS[id] || PROVIDERS[DEFAULT_PROVIDER]
