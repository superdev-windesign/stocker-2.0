// INDmoney provider adapter (US + Indian stocks) — SCAFFOLD.
//
// INDmoney's trading API is not the same as Paytm's. This module defines the seam the
// rest of the app expects (login URL, token exchange, session retrieval) but the live
// calls are intentionally NOT implemented yet: they require INDmoney's actual API spec
// (auth flow, base URL, endpoints) + credentials. Set the INDMONEY_* env vars and fill
// in the marked sections to enable. Until then routes return 501 with a clear message.

const API_KEY = process.env.INDMONEY_API_KEY
const API_SECRET = process.env.INDMONEY_API_SECRET

export const isConfigured = () => Boolean(API_KEY && API_SECRET)

function notImplemented() {
  const e = new Error(
    'INDmoney integration is not configured yet. Set INDMONEY_API_KEY / INDMONEY_API_SECRET ' +
      'and implement the auth flow in backend/lib/indmoney.js (needs INDmoney API details).',
  )
  e.status = 501
  throw e
}

// TODO(indmoney): build the login redirect URL once the OAuth/login flow is known.
export function loginUrl() {
  notImplemented()
}

// TODO(indmoney): exchange the request/auth token for an access token + persist it.
export async function exchangeRequestToken() {
  notImplemented()
}

// TODO(indmoney): read the stored session / token.
export async function getToken() {
  notImplemented()
}
