// Portfolio-aware news: merges Google News across your top holdings, tags each item with
// the stock + position weight + a headline sentiment heuristic, ranked by size × freshness.
import { getDerivedHoldings } from './holdings.js'
import * as gnews from './marketdata/news.js'

const POS = ['surge', 'surges', 'jump', 'jumps', 'soar', 'soars', 'rally', 'rallies', 'gain', 'gains',
  'beat', 'beats', 'record', 'high', 'upgrade', 'upgraded', 'profit', 'rise', 'rises', 'wins', 'win',
  'strong', 'boost', 'outperform', 'buy', 'bullish', 'top', 'expand', 'expands', 'growth']
const NEG = ['fall', 'falls', 'slump', 'slumps', 'drop', 'drops', 'plunge', 'plunges', 'crash', 'crashes',
  'loss', 'losses', 'downgrade', 'downgraded', 'probe', 'fraud', 'decline', 'declines', 'weak', 'cut', 'cuts',
  'miss', 'misses', 'low', 'warn', 'warns', 'sinks', 'tumble', 'tumbles', 'selloff', 'sell-off', 'bearish', 'sell']

function sentiment(title) {
  const t = ` ${title.toLowerCase()} `
  let s = 0
  for (const w of POS) if (t.includes(` ${w} `) || t.includes(`${w},`)) s++
  for (const w of NEG) if (t.includes(` ${w} `) || t.includes(`${w},`)) s--
  return s > 0 ? 'positive' : s < 0 ? 'negative' : 'neutral'
}

const cache = new Map()
async function memo(key, ttlMs, fn) {
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.val
  const val = await fn()
  cache.set(key, { exp: Date.now() + ttlMs, val })
  return val
}

export function getPortfolioNews(userId, country = null) {
  return memo(`pnews:${userId}${country ? `:${country}` : ''}`, 5 * 60_000, async () => {
    let holdings = await getDerivedHoldings(userId)
    if (country) holdings = holdings.filter((h) => (h.country || 'IN') === country)
    if (!holdings.length) return { items: [], holdings: 0 }

    // Top 10 holdings by value carry the most weight in the feed.
    const top = [...holdings].sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0)).slice(0, 10)
    const total = top.reduce((s, h) => s + (h.currentValue || 0), 0) || 1

    const results = await Promise.allSettled(
      top.map(async (h) => {
        const q = `${h.name || h.symbol} share`
        const news = await gnews.search(q)
        const weight = (h.currentValue || 0) / total
        return news.slice(0, 4).map((n) => ({
          ...n,
          symbol: h.symbol,
          stockName: h.name || h.symbol,
          weight,
          pnlPct: h.pnlPct ?? null,
          sentiment: sentiment(n.title),
        }))
      }),
    )

    const all = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value)

    // Dedupe by headline
    const seen = new Set()
    const deduped = []
    for (const it of all) {
      const key = it.title.slice(0, 60).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(it)
    }

    // Rank: position weight + freshness (newer within ~36h boosts).
    const now = Date.now()
    const score = (it) =>
      it.weight + Math.max(0, 1 - (now - (it.publishedAt || 0)) / (36 * 3600_000)) * 0.6
    deduped.sort((a, b) => score(b) - score(a))

    return { items: deduped.slice(0, 24), holdings: holdings.length }
  })
}
