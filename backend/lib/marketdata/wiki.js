// Wikipedia profile/summary lookup (no API key). Used for the "Profile" section.
const WIKI_HEADERS = { 'User-Agent': 'Stocker/1.0 (portfolio analytics app)', 'Accept': 'application/json' }

const cache = new Map()
async function memo(key, ttlMs, fn) {
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.val
  const val = await fn()
  cache.set(key, { exp: Date.now() + ttlMs, val })
  return val
}

// REST summary for an exact title (follows redirects). Returns null if missing/disambiguation.
async function fetchSummary(title) {
  const r = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
    { headers: WIKI_HEADERS },
  )
  if (!r.ok) return null
  const j = await r.json()
  if (j.type === 'disambiguation' || !j.extract) return null
  return {
    title: j.title,
    description: j.description || null,
    extract: j.extract,
    url: j.content_urls?.desktop?.page || null,
    thumbnail: j.thumbnail?.source || null,
  }
}

// Find the best Wikipedia title for a free-text query (company/index name).
async function bestTitle(query) {
  const r = await fetch(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json`,
    { headers: WIKI_HEADERS },
  )
  if (!r.ok) return null
  const arr = await r.json()
  return arr?.[1]?.[0] || null
}

// Public: best-effort Wikipedia summary for a company or index name.
export const summary = (query) =>
  memo(`wiki:${query}`, 24 * 3600_000, async () => {
    if (!query) return null
    // 1) direct title match
    let res = await fetchSummary(query)
    if (res) return res
    // 2) search for the closest title, then summarize it
    const title = await bestTitle(query)
    if (title) {
      res = await fetchSummary(title)
      if (res) return res
    }
    return null
  })
