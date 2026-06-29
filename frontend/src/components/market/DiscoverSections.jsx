// "Related assets" + "Discover more" sections for the stock detail page (Google Finance style).
import { useEffect, useState } from 'react'
import Sparkline from './Sparkline'
import AddToListButton from './AddToListButton'
import { marketYahooQuote, marketChart } from '../../services/marketApi'

const fmt = (v, dec = 2) =>
  v == null ? '—' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })

// ── Curated lists per market ──────────────────────────────────────────────────
const IDX = (symbol, label, short) => ({ symbol, label, short, type: 'index' })
const STK = (symbol, name) => ({ symbol, name, type: 'stock' })

const RELATED = {
  US: [IDX('^DJI', 'Dow Jones Industrial Average', '.DJI'), IDX('^RUT', 'Russell 2000 Index', 'RUT'),
       IDX('^IXIC', 'Nasdaq Composite', 'IXIC'), IDX('^GSPC', 'S&P 500', 'SPX')],
  IN: [IDX('^NSEI', 'Nifty 50', 'NIFTY'), IDX('^BSESN', 'Sensex', 'SENSEX'),
       IDX('^NSEBANK', 'Nifty Bank', 'BANKNIFTY'), IDX('^CNXIT', 'Nifty IT', 'NIFTYIT')],
}
const DISCOVER_STOCKS = {
  US: [STK('AAPL', 'Apple Inc'), STK('AMZN', 'Amazon.com Inc'), STK('META', 'Meta Platforms Inc'),
       STK('NVDA', 'NVIDIA Corp'), STK('MSFT', 'Microsoft Corp'), STK('GOOGL', 'Alphabet Inc')],
  IN: [STK('RELIANCE', 'Reliance Industries'), STK('TCS', 'Tata Consultancy'), STK('HDFCBANK', 'HDFC Bank'),
       STK('INFY', 'Infosys'), STK('ICICIBANK', 'ICICI Bank'), STK('SBIN', 'State Bank of India')],
}
const DISCOVER_INDICES = {
  US: [IDX('^DJI', 'Dow Jones Industrial Average'), IDX('^RUT', 'Russell 2000 Index'), IDX('^FTSE', 'FTSE 100 Index'),
       IDX('^GSPTSE', 'S&P/TSX Composite Index'), IDX('^NDX', 'Nasdaq-100'), IDX('^IXIC', 'Nasdaq Composite')],
  IN: [IDX('^NSEI', 'Nifty 50'), IDX('^BSESN', 'Sensex'), IDX('^NSEBANK', 'Nifty Bank'),
       IDX('^CNXIT', 'Nifty IT'), IDX('^CNXAUTO', 'Nifty Auto'), IDX('^CNXPHARMA', 'Nifty Pharma')],
}

const yahooFor = (it, country) =>
  it.type === 'index' ? it.symbol : country === 'US' ? it.symbol : `${it.symbol}.NS`

function useQuote(yahooSymbol, withSpark = false) {
  const [q, setQ] = useState(null)
  const [spark, setSpark] = useState(null)
  useEffect(() => {
    if (!yahooSymbol) return
    let off = false
    marketYahooQuote(yahooSymbol).then((r) => { if (!off) setQ(r) }).catch(() => {})
    if (withSpark) marketChart(yahooSymbol, '5m', '1d')
      .then((d) => { if (!off) setSpark(d?.candles?.map((c) => c.close).filter((v) => v != null) || []) })
      .catch(() => { if (!off) setSpark([]) })
    return () => { off = true }
  }, [yahooSymbol, withSpark])
  return { q, spark }
}

// ── Related asset card (with sparkline) ───────────────────────────────────────
function RelatedCard({ it, country, onOpen }) {
  const yahooSymbol = yahooFor(it, country)
  const { q, spark } = useQuote(yahooSymbol, true)
  const up = (q?.changePct ?? 0) >= 0
  const cur = it.type === 'stock' ? (country === 'US' ? '$' : '₹') : ''
  return (
    <button onClick={() => onOpen(it)}
      className="flex min-w-[200px] flex-1 flex-col rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-slate-50 hover:shadow-md dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-indigo-500/40 dark:hover:bg-white/[0.04]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{it.short || it.symbol.replace('^', '')}</p>
      <p className="mt-0.5 truncate text-[13px] font-bold text-slate-900 dark:text-slate-100">{it.label || it.name}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{cur}{fmt(q?.price)}</p>
      <p className={`flex items-center gap-1 text-[12px] font-semibold ${up ? 'text-emerald-500' : 'text-red-500'}`}>
        {q?.changePct == null ? '—' : `${up ? '+' : ''}${q.changePct.toFixed(2)}%`}
        <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] ${up ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>{up ? '▲' : '▼'}</span>
      </p>
      <div className="mt-2 h-10">
        {spark === null ? <div className="h-full w-full animate-pulse rounded bg-slate-100 dark:bg-white/5" />
          : <Sparkline data={spark} width={180} height={40} baseline={q?.prevClose} />}
      </div>
    </button>
  )
}

// ── Discover card (no sparkline, with + add-to-list) ──────────────────────────
function DiscoverCard({ it, country, onOpen }) {
  const yahooSymbol = yahooFor(it, country)
  const { q } = useQuote(yahooSymbol, false)
  const up = (q?.changePct ?? 0) >= 0
  const cur = it.type === 'stock' ? (country === 'US' ? '$' : '₹') : ''
  const itemCountry = country
  return (
    <div onClick={() => onOpen(it)}
      className="flex min-w-[180px] cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-slate-50 hover:shadow-md dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-indigo-500/40 dark:hover:bg-white/[0.04]">
      <span className={`mb-2 inline-block w-fit rounded px-1.5 py-0.5 text-[10px] font-bold ${
        it.type === 'index' ? 'border border-slate-300 text-slate-500 dark:border-white/20 dark:text-slate-400'
          : 'bg-slate-700 text-white'
      }`}>
        {it.type === 'index' ? 'INDEX' : it.symbol}
      </span>
      <p className="min-h-[34px] text-[13px] font-semibold leading-tight text-slate-900 dark:text-slate-100">{it.name || it.label}</p>
      <p className="mt-2 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{cur}{fmt(q?.price)}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-semibold ${up ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
          {q?.changePct == null ? '—' : `${up ? '↑' : '↓'} ${Math.abs(q.changePct).toFixed(2)}%`}
        </span>
        <AddToListButton compact item={{
          symbol: it.symbol, yahooSymbol, name: it.name || it.label,
          exchange: it.type === 'index' ? 'INDEX' : 'NSE', type: it.type, country: itemCountry,
        }} />
      </div>
    </div>
  )
}

function Row({ children }) {
  return <div className="thin-scroll flex gap-3 overflow-x-auto pb-2">{children}</div>
}

// ── Public: Related assets ────────────────────────────────────────────────────
export function RelatedAssets({ country = 'IN', currentSymbol, onOpen }) {
  const items = (RELATED[country] || RELATED.IN).filter((it) => it.symbol !== currentSymbol)
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-slate-100">Related assets</h2>
      <div className="flex flex-wrap gap-3">
        {items.map((it) => <RelatedCard key={it.symbol} it={it} country={country} onOpen={onOpen} />)}
      </div>
    </section>
  )
}

// ── Public: Discover more (two horizontal rows) ───────────────────────────────
export function DiscoverMore({ country = 'IN', currentSymbol, onOpen }) {
  const stocks = (DISCOVER_STOCKS[country] || DISCOVER_STOCKS.IN).filter((it) => it.symbol !== currentSymbol)
  const indices = (DISCOVER_INDICES[country] || DISCOVER_INDICES.IN).filter((it) => it.symbol !== currentSymbol)
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Discover more</h2>
      <div>
        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">You may be interested in</p>
        <Row>{stocks.map((it) => <DiscoverCard key={it.symbol} it={it} country={country} onOpen={onOpen} />)}</Row>
      </div>
      <div>
        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">People also search for</p>
        <Row>{indices.map((it) => <DiscoverCard key={it.symbol} it={it} country={country} onOpen={onOpen} />)}</Row>
      </div>
    </section>
  )
}
