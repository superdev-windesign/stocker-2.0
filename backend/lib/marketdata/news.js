// Stock/market news via Google News RSS (free, India-localized, broad source coverage).
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' }

const cache = new Map()
async function memo(key, ttlMs, fn) {
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.val
  const val = await fn()
  cache.set(key, { exp: Date.now() + ttlMs, val })
  return val
}

const decode = (s = '') =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ').trim()

// Search Google News for a query (company/index name). Returns up to 16 items.
export const search = (query) =>
  memo(`gnews:${query}`, 5 * 60_000, async () => {
    if (!query) return []
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`
    const r = await fetch(url, { headers: HEADERS })
    if (!r.ok) return []
    const xml = await r.text()
    const items = []
    const itemRe = /<item>([\s\S]*?)<\/item>/g
    let m
    while ((m = itemRe.exec(xml)) && items.length < 16) {
      const block = m[1]
      const pick = (tag) => {
        const mm = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
        return mm ? mm[1] : ''
      }
      let title = decode(pick('title'))
      const link = decode(pick('link'))
      const pub = pick('pubDate')
      const srcM = block.match(/<source[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/)
      const sourceUrl = srcM?.[1] || null
      let publisher = decode(srcM?.[2] || '')
      // Google News titles end with " - Publisher" — strip it.
      if (publisher && title.endsWith(` - ${publisher}`)) title = title.slice(0, -(publisher.length + 3))
      else if (!publisher) {
        const idx = title.lastIndexOf(' - ')
        if (idx > 0) { publisher = title.slice(idx + 3); title = title.slice(0, idx) }
      }
      if (!title || !link) continue
      items.push({ title, link, publisher: publisher || 'News', sourceUrl, publishedAt: pub ? Date.parse(pub) : null })
    }
    return items
  })
