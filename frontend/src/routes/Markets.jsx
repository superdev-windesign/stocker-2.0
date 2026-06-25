import { useEffect, useMemo, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { marketQuote, marketHistory, marketSearch, marketMovers, marketOverview } from '../services/marketApi'
import { Card, SectionTitle, StatPill, Skeleton, EmptyState } from '../components/common/ui'

const fmtNum = (n, d = 2) => (n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d }))
const fmtCompact = (n) => {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${fmtNum(n)}`
}

function StockPanel({ symbol }) {
  const [data, setData] = useState({ loading: true })
  useEffect(() => {
    let cancelled = false
    setData({ loading: true })
    Promise.allSettled([marketQuote(symbol), marketOverview(symbol), marketHistory(symbol)])
      .then(([q, o, h]) => {
        if (cancelled) return
        setData({
          loading: false,
          quote: q.status === 'fulfilled' ? q.value : null,
          overview: o.status === 'fulfilled' ? o.value : null,
          history: h.status === 'fulfilled' ? h.value : [],
          error: q.status === 'rejected' ? q.reason?.message : null,
        })
      })
    return () => { cancelled = true }
  }, [symbol])

  if (data.loading) return <Skeleton className="h-80" />
  if (data.error && !data.quote) {
    return <EmptyState icon="⚠️" title={`Couldn't load ${symbol}`} message={data.error} />
  }
  const q = data.quote || {}
  const o = data.overview || {}
  const chart = (data.history || []).slice(-120).map((d) => ({ date: d.date, close: d.close }))
  const up = (q.changePct ?? 0) >= 0

  const facts = [
    ['Sector', o.sector || '—'],
    ['Market Cap', fmtCompact(o.marketCap)],
    ['P/E', fmtNum(o.peRatio)],
    ['EPS', fmtNum(o.eps)],
    ['Div Yield', o.dividendYield != null ? `${(o.dividendYield * 100).toFixed(2)}%` : '—'],
    ['Beta', fmtNum(o.beta)],
    ['52W High', fmtNum(o.week52High)],
    ['52W Low', fmtNum(o.week52Low)],
  ]

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{q.symbol || symbol}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{o.name || ''} {o.exchange ? `· ${o.exchange}` : ''}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {q.price != null ? `${o.currency === 'INR' ? '₹' : '$'}${fmtNum(q.price)}` : '—'}
          </div>
          <StatPill value={q.changePct} />
        </div>
      </div>

      <div className="mt-4 h-56">
        {chart.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={48} />
              <Tooltip />
              <Line type="monotone" dataKey="close" stroke={up ? '#16c784' : '#ea3943'} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No history available.</div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 p-2 dark:border-white/10">
            <div className="text-xs text-slate-500 dark:text-slate-400">{k}</div>
            <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Movers() {
  const [tab, setTab] = useState('gainers')
  const [data, setData] = useState({ loading: true })
  useEffect(() => {
    marketMovers().then((d) => setData({ loading: false, ...d })).catch((e) => setData({ loading: false, error: e.message }))
  }, [])

  const rows = data[tab] || []
  return (
    <Card className="p-4">
      <SectionTitle
        title="Market Movers"
        subtitle={data.lastUpdated ? `as of ${data.lastUpdated.slice(0, 16)}` : 'top gainers / losers / most active'}
        right={
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
            {[['gainers', 'Gainers'], ['losers', 'Losers'], ['active', 'Active']].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${tab === v ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}>{l}</button>
            ))}
          </div>
        }
      />
      {data.loading ? (
        <Skeleton className="h-48" />
      ) : data.error ? (
        <p className="py-6 text-center text-sm text-slate-400">{data.error}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {rows.map((r) => (
            <li key={r.symbol} className="flex items-center justify-between py-2">
              <span className="font-medium text-slate-900 dark:text-slate-100">{r.symbol}</span>
              <span className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">${fmtNum(r.price)}</span>
                <StatPill value={r.changePct} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function Markets() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [active, setActive] = useState(null)
  const [searching, setSearching] = useState(false)
  const debounce = useRef(null)

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await marketSearch(q.trim()))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(debounce.current)
  }, [q])

  return (
    <div className="space-y-6">
      <SectionTitle title="Markets" subtitle="Search any stock · quotes, history & fundamentals · live movers (AlphaVantage)" />

      <Card className="p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a stock (e.g. AAPL, TSLA, RELIANCE.BSE)…"
          className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-white/10"
        />
        {searching && <p className="mt-2 text-xs text-slate-400">Searching…</p>}
        {results.length > 0 && (
          <ul className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-white/10">
            {results.map((r) => (
              <li key={r.symbol}>
                <button
                  onClick={() => { setActive(r.symbol); setResults([]); setQ('') }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">{r.symbol}</span>
                  <span className="truncate text-xs text-slate-400">{r.name} · {r.region}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {active ? <StockPanel symbol={active} /> : (
        <EmptyState icon="🔎" title="Search a stock to begin" message="Look up any US or Indian symbol to see its quote, price history, and fundamentals." />
      )}

      <Movers />

      <p className="text-xs text-slate-400">
        Powered by AlphaVantage. Free-tier data is rate-limited and cached; if you see a limit message, try again shortly.
      </p>
    </div>
  )
}
