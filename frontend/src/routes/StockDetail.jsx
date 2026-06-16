import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { usePriceChart, TIMEFRAMES } from '../hooks/usePriceChart'
import { stockStats } from '../analytics/stockMetrics'
import { Card, SectionTitle, Timeframe, Skeleton, EmptyState } from '../components/common/ui'
import StockHeader from '../components/stock/StockHeader'
import PositionSummary from '../components/stock/PositionSummary'
import PriceChartWithMarkers from '../components/stock/PriceChartWithMarkers'
import BuySellTimeline from '../components/stock/BuySellTimeline'
import PerformanceMetrics from '../components/stock/PerformanceMetrics'
import AthAtlSection from '../components/stock/AthAtlSection'

export default function StockDetail() {
  const { securityId } = useParams()
  const navigate = useNavigate()
  const { holdings, orders, loading } = usePortfolio()
  const [tf, setTf] = useState('1Y')

  const holding = useMemo(
    () => holdings.find((h) => String(h.securityId) === String(securityId)),
    [holdings, securityId],
  )

  const { candles, loading: chartLoading, error: chartError } = usePriceChart(
    securityId,
    holding?.exchange || 'NSE',
    tf,
  )
  const stats = useMemo(() => (candles.length ? stockStats(candles) : null), [candles])

  // Today's trades for this stock (overlay markers + timeline).
  const trades = useMemo(() => {
    const sym = holding?.symbol
    return (orders || [])
      .filter((o) => {
        const s = o.security_symbol || o.symbol || o.tradingsymbol || o.display_name
        return sym && String(s).toUpperCase() === String(sym).toUpperCase()
      })
      .map((o) => {
        const qty = Number(o.quantity || o.qty || 0)
        const price = Number(o.avg_traded_price || o.price || 0)
        const t = o.order_date_time || o.create_time || o.exchange_time
        const side = String(o.txn_type || o.transaction_type || o.type || 'B').toUpperCase().startsWith('B') ? 'BUY' : 'SELL'
        return { time: t ? Math.floor(new Date(t).getTime() / 1000) : null, side, qty, price, value: qty * price }
      })
  }, [orders, holding])

  const markers = useMemo(() => trades.filter((t) => t.time).map((t) => ({ ...t })), [trades])

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-80" /></div>
  }

  if (!holding) {
    return (
      <EmptyState
        icon="🔍"
        title="Stock not in your holdings"
        message="This security isn't in your current Paytm holdings."
        action={
          <button onClick={() => navigate('/')} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
            Back to portfolio
          </button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        ← Back to portfolio
      </button>

      <StockHeader holding={holding} />

      <Card className="p-4">
        <SectionTitle
          title="Price Chart"
          subtitle="🟠 avg buy · 🟢 buy · 🔴 sell"
          right={<Timeframe options={TIMEFRAMES} value={tf} onChange={setTf} />}
        />
        {chartLoading ? (
          <Skeleton className="h-[360px]" />
        ) : chartError ? (
          <div className="flex h-[360px] items-center justify-center text-sm text-slate-500">
            Couldn't load candles: {chartError}
          </div>
        ) : (
          <PriceChartWithMarkers candles={candles} avgPrice={holding.avgPrice} markers={markers} />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <PositionSummary holding={holding} />
        <AthAtlSection holding={holding} stats={stats} />
      </div>

      <PerformanceMetrics holding={holding} stats={stats} />
      <BuySellTimeline trades={trades} />
    </div>
  )
}
