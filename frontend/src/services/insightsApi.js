// AI Portfolio Analyst endpoint. Sends the compact metrics payload; the backend calls
// the LLM (OpenRouter) or falls back to a heuristic, and caches by inputs hash.
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

export async function fetchInsight(scope, payload, { refresh = false } = {}) {
  const res = await fetch(`${BACKEND_URL}/api/insights`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, payload, refresh }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data // { text, model, cached, scope, periodKey }
}
