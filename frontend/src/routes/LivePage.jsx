// Google Finance-style market home: sector sidebar · index cards w/ sparklines · 3-col movers.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '../components/common/ui'
import Sparkline from '../components/market/Sparkline'
import NewsWidget from '../components/market/NewsWidget'
import { marketIndices, marketSectors, marketNseQuotes, marketUsQuotes, marketChart, marketYahooQuote, marketSearch } from '../services/marketApi'
import { useWatchlists } from '../context/WatchlistContext'

// ── formatting helpers ────────────────────────────────────────────────────────
const fmt = (v, dec = 2) =>
  v == null ? '—' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtINR = (v, dec = 2) => (v == null ? '—' : `₹${fmt(v, dec)}`)
const pctStr = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)
const Arrow = ({ up }) => (
  <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${up ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'}`}>
    {up ? '▲' : '▼'}
  </span>
)

// NSE open Mon–Fri 9:15–15:30 IST
function isNSEOpen() {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const t = ist.getHours() * 60 + ist.getMinutes()
  return ist.getDay() > 0 && ist.getDay() < 6 && t >= 555 && t < 930
}

// ── Index card with live sparkline (clickable → index detail) ─────────────────
function IndexCard({ idx, onClick }) {
  const [spark, setSpark] = useState(null)
  useEffect(() => {
    let off = false
    if (!idx?.symbol) return
    marketChart(idx.symbol, '5m', '1d')
      .then((d) => { if (!off) setSpark(d?.candles?.map((c) => c.close).filter((v) => v != null) || []) })
      .catch(() => { if (!off) setSpark([]) })
    return () => { off = true }
  }, [idx?.symbol])

  const up = (idx?.changePct ?? 0) >= 0
  const color = up ? 'text-emerald-500' : 'text-red-500'
  return (
    <button
      onClick={onClick}
      className="group flex min-w-[180px] flex-1 flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-slate-50 hover:shadow-md dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-indigo-500/40 dark:hover:bg-white/[0.04]"
    >
      <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{idx?.label || '—'}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmt(idx?.price)}</p>
      <p className="text-xs tabular-nums text-slate-500">
        ({idx?.change >= 0 ? '+' : ''}{fmt(idx?.change)})
      </p>
      <div className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${color}`}>
        {pctStr(idx?.changePct)} <Arrow up={up} />
      </div>
      <div className="mt-2 h-12">
        {spark === null
          ? <div className="h-full w-full animate-pulse rounded bg-slate-100 dark:bg-white/5" />
          : <Sparkline data={spark} width={200} height={48} baseline={idx?.prevClose} />}
      </div>
    </button>
  )
}

// ── Mini intraday sparkline for a sidebar row ─────────────────────────────────
function MiniSpark({ symbol, baseline }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!symbol) { setData([]); return }
    let off = false
    marketChart(symbol, '5m', '1d')
      .then((d) => { if (!off) setData(d?.candles?.map((c) => c.close).filter((v) => v != null) || []) })
      .catch(() => { if (!off) setData([]) })
    return () => { off = true }
  }, [symbol])
  if (data === null) return <div className="h-7 w-14 shrink-0 animate-pulse rounded bg-slate-100 dark:bg-white/5" />
  return <div className="shrink-0"><Sparkline data={data} width={56} height={28} baseline={baseline} /></div>
}

// ── Rich sidebar row: symbol/name · sparkline · price · % (Google Finance look) ──
// `preQuote` lets sector rows skip the quote fetch (they already have price/changePct).
function QuoteRow({ topLabel, subLabel, yahooSymbol, currency = '₹', preQuote = null, onClick }) {
  const [q, setQ] = useState(preQuote)
  useEffect(() => {
    if (preQuote || !yahooSymbol) return
    let off = false
    marketYahooQuote(yahooSymbol).then((r) => { if (!off) setQ(r) }).catch(() => {})
    return () => { off = true }
  }, [yahooSymbol, preQuote])
  const up = (q?.changePct ?? 0) >= 0
  return (
    <button onClick={onClick} className="-mx-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.03]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-slate-900 dark:text-slate-100">{topLabel}</p>
        <p className="truncate text-[11px] text-slate-400">{subLabel}</p>
      </div>
      <MiniSpark symbol={yahooSymbol} baseline={q?.prevClose} />
      <div className="shrink-0 text-right">
        <p className="text-[12px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">{currency}{fmt(q?.price)}</p>
        <p className={`flex items-center justify-end gap-0.5 text-[11px] font-semibold tabular-nums ${up ? 'text-emerald-500' : 'text-red-500'}`}>
          {pctStr(q?.changePct)} <Arrow up={up} />
        </p>
      </div>
    </button>
  )
}

// ── Collapsible sidebar section ───────────────────────────────────────────────
function SidebarSection({ title, right, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded text-[15px] font-semibold text-slate-900 transition hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
          {title}
        </button>
        <div className="flex items-center gap-2 text-slate-400">
          {right}
          <button onClick={() => setOpen((o) => !o)} className="text-xs transition hover:text-slate-700 dark:hover:text-slate-200">{open ? '▲' : '▼'}</button>
        </div>
      </div>
      {open && <div className="divide-y divide-slate-100 dark:divide-white/5">{children}</div>}
    </div>
  )
}

// ── Watchlists nav (one collapsible section per list) ──────────────────────────
function WatchlistsNav({ onPickItem }) {
  const { lists } = useWatchlists()
  if (!lists.length) return null
  return (
    <div className="space-y-4">
      {lists.map((l) => (
        <SidebarSection key={l.id} title={l.name}>
          {l.items.length === 0
            ? <p className="py-2 text-[11px] text-slate-400">This list is empty</p>
            : l.items.map((it) => (
                <QuoteRow
                  key={it.symbol}
                  topLabel={it.type === 'index' ? (it.name || it.symbol) : it.symbol}
                  subLabel={it.type === 'index' ? 'Index' : (it.name || it.exchange)}
                  yahooSymbol={it.yahooSymbol || it.symbol}
                  currency={it.country === 'US' ? '$' : '₹'}
                  onClick={() => onPickItem(it)}
                />
              ))}
        </SidebarSection>
      ))}
    </div>
  )
}

// ── Mover row (Most active / Gainers / Losers column) ─────────────────────────
function MoverRow({ q, cur, onClick }) {
  const up = (q.changePct ?? 0) >= 0
  const sym = q.nsSymbol || q.symbol
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.03] -mx-2 px-2 rounded-lg">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100">{sym}</p>
        {q.name && <p className="max-w-[150px] truncate text-[11px] text-slate-400">{q.name}</p>}
      </div>
      <div className="ml-2 text-right">
        <p className="text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">{cur}{fmt(q.price)}</p>
        <p className={`flex items-center justify-end gap-1 text-[11px] font-medium tabular-nums ${up ? 'text-emerald-500' : 'text-red-500'}`}>
          {pctStr(q.changePct)} <Arrow up={up} />
        </p>
      </div>
    </button>
  )
}

function MoverColumn({ title, rows, cur, onPick }) {
  return (
    <div>
      <h3 className="mb-2 text-[15px] font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {rows.length === 0
          ? <p className="py-6 text-center text-xs text-slate-400">No data</p>
          : rows.map((q) => <MoverRow key={q.nsSymbol || q.symbol} q={q} cur={cur} onClick={() => onPick(q.nsSymbol || q.symbol)} />)}
      </div>
    </div>
  )
}

// ── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({ onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    timer.current = setTimeout(async () => {
      try { setResults(await marketSearch(q.trim())); setOpen(true) } catch { setResults([]) }
    }, 350)
    return () => clearTimeout(timer.current)
  }, [q])

  return (
    <div ref={ref} className="relative w-full">
      <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-4 py-2.5 focus-within:border-indigo-500 focus-within:bg-white dark:border-white/15 dark:bg-white/5 dark:focus-within:bg-slate-900">
        <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1 0 6.5 6.5a7.5 7.5 0 0 0 10.6 10.6z" />
        </svg>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)}
          placeholder="Search for stocks, ETFs and more"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 text-slate-900 dark:text-slate-100"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
          {results.slice(0, 8).map((r) => (
            <button key={r.symbol} onClick={() => { setQ(''); setOpen(false); onPick(r.symbol.replace(/\.(NS|BO|BSE)$/i, '')) }}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{r.symbol}</span>
              <span className="ml-2 truncate text-xs text-slate-400">{r.name} · {r.region}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const REGIONS = [
  { id: 'IN', label: 'India' },
  { id: 'US', label: 'US' },
]

export default function LivePage() {
  const navigate = useNavigate()
  const [indices, setIndices] = useState([])
  const [sectors, setSectors] = useState([])
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('IN')
  const [updated, setUpdated] = useState(null)
  const open = isNSEOpen()

  const cur = region === 'IN' ? '₹' : '$'

  const load = useCallback(async (rgn) => {
    const quotesFn = rgn === 'US' ? marketUsQuotes : marketNseQuotes
    const [idx, sec, qs] = await Promise.allSettled([marketIndices(), marketSectors(rgn), quotesFn()])
    if (idx.status === 'fulfilled' && Array.isArray(idx.value)) setIndices(idx.value)
    if (sec.status === 'fulfilled' && Array.isArray(sec.value)) setSectors(sec.value)
    if (qs.status === 'fulfilled' && Array.isArray(qs.value)) setStocks(qs.value)
    setUpdated(new Date())
    setLoading(false)
  }, [])

  // Refetch everything region-specific whenever the region switches (and every 60s).
  useEffect(() => {
    setLoading(true)
    setStocks([]); setSectors([])   // drop stale region data immediately on switch
    load(region)
    const id = setInterval(() => load(region), 60_000)
    return () => clearInterval(id)
  }, [region, load])

  const goStock = (sym) => navigate(`/stock/sym/${encodeURIComponent(sym)}${region === 'US' ? '?mkt=US' : ''}`)
  const goIndex = (yahooSymbol, rgn = region) => navigate(`/stock/sym/${encodeURIComponent(yahooSymbol)}?type=index&mkt=${rgn}`)
  const goItem = (it) => {
    if (it.type === 'index') return goIndex(it.yahooSymbol || it.symbol, it.country || 'IN')
    navigate(`/stock/sym/${encodeURIComponent(it.symbol)}${it.country === 'US' ? '?mkt=US' : ''}`)
  }

  const regionIndices = useMemo(() => indices.filter((d) => d.region === region), [indices, region])

  const withPrice = useMemo(() => stocks.filter((s) => s.price != null), [stocks])
  const mostActive = useMemo(() => [...withPrice].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 8), [withPrice])
  const gainers = useMemo(() => [...withPrice].filter((s) => (s.changePct ?? 0) > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 8), [withPrice])
  const losers = useMemo(() => [...withPrice].filter((s) => (s.changePct ?? 0) < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 8), [withPrice])

  return (
    <div className="flex gap-6">
      {/* ── Left sidebar: watchlists + sectors (scrollable) ── */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="thin-scroll sticky top-4 max-h-[calc(100vh-2rem)] space-y-5 overflow-y-auto pr-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Lists</h2>
          <WatchlistsNav onPickItem={goItem} />
          <SidebarSection title={region === 'US' ? 'US sectors' : 'Equity sectors'}>
            {loading && !sectors.length
              ? Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="my-2 h-9" />)
              : sectors.map((s) => (
                  <QuoteRow
                    key={s.yahooSymbol || s.label}
                    topLabel={s.label}
                    subLabel={s.sector}
                    yahooSymbol={s.yahooSymbol}
                    currency={region === 'US' ? '$' : '₹'}
                    preQuote={{ price: s.price, changePct: s.changePct, prevClose: s.prevClose }}
                    onClick={() => goIndex(s.yahooSymbol)}
                  />
                ))}
          </SidebarSection>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="min-w-0 flex-1 space-y-6">
        {/* Header + search */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Markets</h1>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${open ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${open ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
                {open ? 'NSE Open' : 'NSE Closed'}
              </span>
              {updated && <span className="hidden text-xs text-slate-400 sm:inline">{updated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          </div>
          <SearchBar onPick={goStock} />
        </div>

        {/* Region tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-white/10">
          {REGIONS.map((r) => (
            <button key={r.id} onClick={() => setRegion(r.id)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${region === r.id
                ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Index cards w/ sparklines */}
        <div className="flex flex-wrap gap-3">
          {loading && !regionIndices.length
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 min-w-[180px] flex-1" />)
            : regionIndices.map((idx) => (
                <IndexCard key={idx.symbol} idx={idx} onClick={() => goIndex(idx.symbol)} />
              ))}
        </div>

        {/* 3-column movers */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
          {loading && !withPrice.length ? (
            <div className="grid gap-6 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              <MoverColumn title="Most active" rows={mostActive} cur={cur} onPick={goStock} />
              <MoverColumn title="Daily gainers" rows={gainers} cur={cur} onPick={goStock} />
              <MoverColumn title="Daily losers" rows={losers} cur={cur} onPick={goStock} />
            </div>
          )}
        </div>

        {/* News */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
          <h2 className="mb-3 text-[15px] font-semibold text-slate-900 dark:text-slate-100">Market news</h2>
          <NewsWidget />
        </div>

        <p className="pb-4 text-center text-xs text-slate-400">
          Prices via Yahoo Finance · sectors &amp; indices refresh every 60s · click any stock for chart &amp; history.
        </p>
      </main>
    </div>
  )
}
