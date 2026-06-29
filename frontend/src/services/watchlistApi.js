// Watchlist CRUD — all calls carry the auth cookie.
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

async function req(path, opts = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = new Error(body?.error || `Request failed (${res.status})`)
    e.status = res.status
    throw e
  }
  return body
}

export const fetchWatchlists  = () => req('/api/watchlists')
export const createWatchlist  = (name) => req('/api/watchlists', { method: 'POST', body: JSON.stringify({ name }) })
export const deleteWatchlist  = (id) => req(`/api/watchlists/${id}`, { method: 'DELETE' })
export const addToWatchlist   = (id, item) => req(`/api/watchlists/${id}/items`, { method: 'POST', body: JSON.stringify(item) })
export const removeFromWatchlist = (id, symbol) =>
  req(`/api/watchlists/${id}/items/${encodeURIComponent(symbol)}`, { method: 'DELETE' })
