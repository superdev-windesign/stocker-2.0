// "News stories" + "Profile" sections for the stock detail page.
import { useEffect, useState } from 'react'
import { marketStockNews, marketProfile } from '../../services/marketApi'

function timeAgo(ms) {
  if (!ms) return ''
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`
  const d = Math.floor(h / 24); return `${d} day${d > 1 ? 's' : ''} ago`
}

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }
const favicon = (n) => { const h = hostOf(n.sourceUrl || n.link); return h ? `https://www.google.com/s2/favicons?sz=64&domain=${h}` : null }

function NewsItem({ n }) {
  return (
    <a href={n.link} target="_blank" rel="noopener noreferrer"
      className="group block rounded-lg p-2 transition hover:bg-slate-50 dark:hover:bg-white/[0.03]">
      <div className="mb-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        {favicon(n)
          ? <img src={favicon(n)} alt="" className="h-4 w-4 rounded-sm" loading="lazy" />
          : <span className="h-4 w-4 rounded-sm bg-slate-300 dark:bg-white/20" />}
        <span className="font-medium text-slate-600 dark:text-slate-300">{n.publisher}</span>
        {n.publishedAt && <span>· {timeAgo(n.publishedAt)}</span>}
      </div>
      <p className="text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
        {n.title}
      </p>
    </a>
  )
}

export function StockNews({ query }) {
  const [items, setItems] = useState(null)
  const [showAll, setShowAll] = useState(false)
  useEffect(() => {
    if (!query) return
    let off = false
    setItems(null)
    marketStockNews(query)
      .then((d) => { if (!off) setItems(Array.isArray(d) ? d : []) })
      .catch(() => { if (!off) setItems([]) })
    return () => { off = true }
  }, [query])

  if (items !== null && items.length === 0) return null  // hide if no news

  const shown = showAll ? items : items?.slice(0, 6)
  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">News stories</h2>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">From sources across the web</p>
      {items === null ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-white/5" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-1 sm:grid-cols-2">
            {shown.map((n, i) => <NewsItem key={n.link || i} n={n} />)}
          </div>
          {items.length > 6 && (
            <button onClick={() => setShowAll((s) => !s)}
              className="mt-2 flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400">
              {showAll ? 'Show less ▲' : 'Show more ▼'}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export function StockProfile({ query }) {
  const [data, setData] = useState(undefined) // undefined=loading, null=none
  useEffect(() => {
    if (!query) return
    let off = false
    setData(undefined)
    marketProfile(query)
      .then((d) => { if (!off) setData(d || null) })
      .catch(() => { if (!off) setData(null) })
    return () => { off = true }
  }, [query])

  if (data === null) return null
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">Profile</h2>
      {data === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-white/5" />)}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {data.extract}{' '}
          {data.url && (
            <a href={data.url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 underline hover:text-indigo-500 dark:text-indigo-400">
              Wikipedia
            </a>
          )}
        </p>
      )}
    </section>
  )
}
