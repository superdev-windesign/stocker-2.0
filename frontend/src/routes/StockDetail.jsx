import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { usePriceChart, TIMEFRAMES } from '../hooks/usePriceChart'
import { stockStats } from '../analytics/stockMetrics'
import { marketYahooQuote } from '../services/marketApi'
import { Card, SectionTitle, Timeframe, Skeleton, EmptyState } from '../components/common/ui'
import MarketAreaChart from '../components/market/MarketAreaChart'
import AddToListButton from '../components/market/AddToListButton'
import { RelatedAssets, DiscoverMore } from '../components/market/DiscoverSections'
import PositionSummary from '../components/stock/PositionSummary'
import PriceChartWithMarkers from '../components/stock/PriceChartWithMarkers'
import BuySellTimeline from '../components/stock/BuySellTimeline'
import StockJourney from '../components/stock/StockJourney'
import StockTradebook from '../components/stock/StockTradebook'

const fmt = (v, dec = 2) => (v == null ? '—' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }))
const fmtVol = (v) => {
  if (!v) return '—'
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)} L`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)} K`
  return String(v)
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  )
}

export default function StockDetail() {
  const { securityId, symbol: symParam } = useParams()
  const [searchParams] = useSearchParams()
  const mktHint = searchParams.get('mkt') // 'US' when opened from US markets
  const navigate = useNavigate()
  const { holdings, journeys, journeyBySymbol, loading } = usePortfolio()
  const [tf, setTf] = useState('1Y')

  const holding = useMemo(() => {
    if (securityId) return holdings.find((h) => String(h.securityId) === String(securityId))
    return holdings.find((h) => String(h.symbol).toUpperCase() === (symParam || '').toUpperCase())
  }, [holdings, securityId, symParam])

  const journey = useMemo(() => {
    if (holding) return journeyBySymbol.get(String(holding.symbol).toUpperCase())
    if (symParam) return journeyBySymbol.get(symParam.toUpperCase())
    return journeys.find((j) => String(j.securityId) === String(securityId))
  }, [holding, journeys, journeyBySymbol, securityId, symParam])

  // Bare symbol + Yahoo symbol (.NS for India)
  const bareSym = (holding?.symbol || journey?.symbol || symParam || '').toUpperCase()
  const country = holding?.country || journey?.country || (mktHint === 'US' ? 'US' : 'IN')
  // Index symbols come through as Yahoo symbols (^CNXAUTO) — never suffix them with .NS
  const isIndex = bareSym.startsWith('^') || searchParams.get('type') === 'index'
  const yahooSym = bareSym ? (isIndex ? bareSym : country === 'IN' ? `${bareSym}.NS` : bareSym) : null

  // Live market quote (works for ANY stock, portfolio or not) — for header price + stats grid
  const [mq, setMq] = useState(null)
  const [mqLoading, setMqLoading] = useState(true)
  useEffect(() => {
    if (!yahooSym) { setMqLoading(false); return }
    let off = false
    setMqLoading(true)
    marketYahooQuote(yahooSym)
      .then((q) => { if (!off) setMq(q) })
      .catch(() => { if (!off) setMq(null) })
      .finally(() => { if (!off) setMqLoading(false) })
    return () => { off = true }
  }, [yahooSym])

  // Unified subject: portfolio holding > exited journey > pure market quote
  const subject = useMemo(() => {
    if (holding) return holding
    if (journey) return {
      securityId: journey.securityId, symbol: journey.symbol, name: journey.name,
      exchange: journey.exchange || 'NSE', quantity: journey.currentQty,
      avgPrice: journey.avgBuyPrice, lastPrice: journey.lastPrice,
      pnl: journey.unrealizedPnl, pnlPct: journey.totalReturnPct, country,
    }
    if (mq) return {
      symbol: bareSym, name: mq.name, exchange: mq.exchange || 'NSE',
      lastPrice: mq.price, country, marketOnly: true,
    }
    return null
  }, [holding, journey, mq, bareSym, country])

  // Broker-backed chart (Paytm securityId only) — kept for broker provider
  const { candles: brokerCandles } = usePriceChart(holding?.securityId, subject?.exchange || 'NSE', tf)

  // Markers from ledger for portfolio stocks
  const markers = useMemo(() => {
    if (!journey) return []
    return journey.transactions
      .map((t) => ({ time: Math.floor(new Date(t.date).getTime() / 1000), side: t.type, qty: t.quantity, price: t.price, value: t.quantity * t.price }))
      .filter((m) => m.time)
  }, [journey])

  const stats = useMemo(() => (brokerCandles.length ? stockStats(brokerCandles) : null), [brokerCandles])

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-80" /></div>
  }

  if (!subject && !mqLoading) {
    return (
      <EmptyState icon="🔍" title="Stock not found"
        message="Couldn't load market data for this symbol."
        action={<button onClick={() => navigate('/live')} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Back to markets</button>}
      />
    )
  }

  const price = mq?.price ?? subject?.lastPrice
  const change = mq?.change
  const changePct = mq?.changePct
  const up = (changePct ?? 0) >= 0
  const cur = country === 'IN' ? '₹' : '$'
  const useBrokerChart = holding?.securityId && brokerCandles.length > 0

  // Navigate to a related/discover item (index or stock)
  const openItem = (it) => {
    if (it.type === 'index') navigate(`/stock/sym/${encodeURIComponent(it.symbol)}?type=index&mkt=${country}`)
    else navigate(`/stock/sym/${encodeURIComponent(it.symbol)}${country === 'US' ? '?mkt=US' : ''}`)
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => navigate('/live')} className="font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">← Markets</button>
        <span className="text-slate-300 dark:text-white/20">|</span>
        <span className="font-mono text-slate-400">{isIndex ? bareSym.replace('^', '') : bareSym}:{isIndex ? 'INDEX' : (subject?.exchange || 'NSE')}</span>
      </div>

      {/* Header: name + big price + change · Add-to-list on the right */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{subject?.name || bareSym}</h1>
          <div className="mt-1 flex items-end gap-3">
            <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{cur}{fmt(price)}</span>
            {changePct != null && (
              <span className={`mb-1 flex items-center gap-1 text-sm font-semibold ${up ? 'text-emerald-500' : 'text-red-500'}`}>
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${up ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>{up ? '▲' : '▼'}</span>
                {up ? '+' : ''}{fmt(changePct)}% ({up ? '+' : ''}{fmt(change)}) Today
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {mq?.exchange || subject?.exchange || (isIndex ? 'INDEX' : 'NSE')}
          </p>
        </div>
        {yahooSym && (
          <AddToListButton item={{
            symbol: bareSym, yahooSymbol: yahooSym, name: subject?.name || bareSym,
            exchange: isIndex ? 'INDEX' : (subject?.exchange || 'NSE'),
            type: isIndex ? 'index' : 'stock', country,
          }} />
        )}
      </div>

      {/* Chart — Google Finance area chart for symbol mode, broker chart for Paytm */}
      <Card className="p-4">
        {useBrokerChart ? (
          <>
            <SectionTitle title="Price Chart" subtitle="🟠 avg buy · 🟢 buy · 🔴 sell"
              right={<Timeframe options={TIMEFRAMES} value={tf} onChange={setTf} />} />
            <PriceChartWithMarkers candles={brokerCandles} avgPrice={holding?.avgPrice} markers={markers} />
          </>
        ) : yahooSym ? (
          <MarketAreaChart symbol={yahooSym} currency={cur} />
        ) : (
          <div className="flex h-72 items-center justify-center text-sm text-slate-400">No chart available.</div>
        )}
      </Card>

      {/* Stats grid (Open / High / Low / Prev / 52-wk / Volume) */}
      {mq && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatBox label="Open" value={`${cur}${fmt(mq.open)}`} />
          <StatBox label="High" value={`${cur}${fmt(mq.high)}`} />
          <StatBox label="Low" value={`${cur}${fmt(mq.low)}`} />
          <StatBox label="Prev close" value={`${cur}${fmt(mq.prevClose)}`} />
          <StatBox label="52-wk high" value={`${cur}${fmt(mq.week52High)}`} />
          <StatBox label="52-wk low" value={`${cur}${fmt(mq.week52Low)}`} />
        </div>
      )}
      {mq?.volume != null && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatBox label="Volume" value={fmtVol(mq.volume)} />
          {mq.currency && <StatBox label="Currency" value={mq.currency} />}
        </div>
      )}

      {/* Related assets (major indices for this market) */}
      <RelatedAssets country={country} currentSymbol={isIndex ? bareSym : null} onOpen={openItem} />

      {/* ── Portfolio analytics (only when you actually hold / held it) ── */}
      {journey && <StockJourney journey={journey} />}
      {holding && (
        <div className="grid gap-6 lg:grid-cols-2">
          <PositionSummary holding={holding} />
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Your position</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Qty</span><p className="font-semibold tabular-nums">{fmt(holding.quantity, 0)}</p></div>
              <div><span className="text-slate-500">Avg cost</span><p className="font-semibold tabular-nums">{cur}{fmt(holding.avgPrice)}</p></div>
              <div><span className="text-slate-500">Invested</span><p className="font-semibold tabular-nums">{cur}{fmt(holding.invested)}</p></div>
              <div><span className="text-slate-500">Current</span><p className="font-semibold tabular-nums">{cur}{fmt(holding.currentValue)}</p></div>
            </div>
          </div>
        </div>
      )}
      {journey && <StockTradebook transactions={journey.transactions} currency={journey.currency} />}
      {journey?.transactions?.length > 0 && <BuySellTimeline transactions={journey.transactions} />}

      {/* Discover more — You may be interested in / People also search for */}
      <DiscoverMore country={country} currentSymbol={isIndex ? bareSym : bareSym} onOpen={openItem} />

      <p className="pb-4 text-center text-xs text-slate-400">
        Live data via Yahoo Finance · for informational purposes only.
      </p>
    </div>
  )
}
