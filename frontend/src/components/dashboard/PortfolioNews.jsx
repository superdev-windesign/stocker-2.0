// Portfolio-aware news feed — headlines for stocks you hold, tagged + sentiment-flagged.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, SectionTitle } from '../common/ui'
import { portfolioNews } from '../../services/marketApi'

function timeAgo(ms) {
  if (!ms) return ''
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
const favicon = (n) => { const h = hostOf(n.sourceUrl || n.link); return h ? `https://www.google.com/s2/favicons?sz=64&domain=${h}` : null }

const SENT = {
  positive: { dot: 'bg-emerald-500', bar: 'border-l-emerald-500', label: 'text-emerald-600 dark:text-emerald-400', txt: 'Positive' },
  negative: { dot: 'bg-red-500',     bar: 'border-l-red-500',     label: 'text-red-500',                          txt: 'Negative' },
  neutral:  { dot: 'bg-slate-400',   bar: 'border-l-slate-300 dark:border-l-white/20', label: 'text-slate-400',  txt: 'Neutral' },
}

function NewsRow({ n, onStock }) {
  const s = SENT[n.sentiment] || SENT.neutral
  const up = (n.pnlPct ?? 0) >= 0
  return (
    <div className={`border-l-2 ${s.bar} pl-3`}>
      <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <button onClick={() => onStock(n.symbol)}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 transition hover:bg-indigo-100 hover:text-indigo-700 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-indigo-500/20">
          {n.symbol}
        </button>
        {n.pnlPct != null && (
          <span className={`font-medium tabular-nums ${up ? 'text-emerald-500' : 'text-red-500'}`}>
            {up ? '+' : ''}{n.pnlPct.toFixed(2)}%
          </span>
        )}
        <span className={`flex items-center gap-1 ${s.label}`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.txt}</span>
      </div>
      <a href={n.link} target="_blank" rel="noopener noreferrer"
        className="group block text-[14px] font-semibold leading-snug text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
        {n.title}
      </a>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
        {favicon(n) && <img src={favicon(n)} alt="" className="h-3.5 w-3.5 rounded-sm" loading="lazy" />}
        <span>{n.publisher}</span>
        {n.publishedAt && <span>· {timeAgo(n.publishedAt)}</span>}
      </div>
    </div>
  )
}

export default function PortfolioNews({ country }) {
  const [data, setData] = useState(null) // null=loading
  const [showAll, setShowAll] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let off = false
    setData(null)
    portfolioNews(country || undefined)
      .then((d) => { if (!off) setData(d || { items: [] }) })
      .catch(() => { if (!off) setData({ items: [] }) })
    return () => { off = true }
  }, [country])

  const items = data?.items || []
  const shown = showAll ? items : items.slice(0, 8)

  return (
    <Card className="p-4">
      <SectionTitle
        title="News for your holdings"
        subtitle="Headlines for the stocks you own · ranked by position size · sentiment-flagged"
      />
      {data === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-white/5" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No recent news for your holdings.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {shown.map((n, i) => (
              <NewsRow key={n.link || i} n={n} onStock={(sym) => navigate(`/stock/sym/${encodeURIComponent(sym)}`)} />
            ))}
          </div>
          {items.length > 8 && (
            <button onClick={() => setShowAll((s) => !s)}
              className="mt-3 text-sm font-medium text-slate-600 transition hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400">
              {showAll ? 'Show less ▲' : `Show ${items.length - 8} more ▼`}
            </button>
          )}
          <p className="mt-3 text-[11px] text-slate-400">
            Sentiment is a quick headline heuristic, not advice. News via Google News.
          </p>
        </>
      )}
    </Card>
  )
}
