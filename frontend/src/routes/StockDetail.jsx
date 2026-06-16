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
import StockJourney from '../components/stock/StockJourney'

export default function StockDetail() {
  const { securityId } = useParams()
  const navigate = useNavigate()
  const { holdings, journeys, journeyBySymbol, loading } = usePortfolio()
  const [tf, setTf] = useState('1Y')

  // Resolve the stock from current holdings first; otherwise from the ledger
  // (so fully-exited stocks open too).
  const holding = useMemo(
    () => holdings.find((h) => String(h.securityId) === String(securityId)),
    [holdings, securityId],
  )

  const journey = useMemo(() => {
    if (holding) return journeyBySymbol.get(String(holding.symbol).toUpperCase())
    return journeys.find((j) => String(j.securityId) === String(securityId))
  }, [holding, journeys, journeyBySymbol, securityId])

  // A unified subject for the header/chart, whether held or exited.
  const subject = useMemo(() => {
    if (holding) return holding
    if (journey)
      return {
        securityId: journey.securityId,
        symbol: journey.symbol,
        name: journey.name,
        exchange: journey.exchange || 'NSE',
        quantity: journey.currentQty,
        avgPrice: journey.avgBuyPrice,
        lastPrice: journey.lastPrice,
        pnl: journey.unrealizedPnl,
        pnlPct: journey.totalReturnPct,
      }
    return null
  }, [holding, journey])

  const { candles, loading: chartLoading, error: chartError } = usePriceChart(
    subject?.securityId,
    subject?.exchange || 'NSE',
    tf,
  )
  const stats = useMemo(() => (candles.length ? stockStats(candles) : null), [candles])

  // BUY/SELL markers from the full lifetime ledger.
  const markers = useMemo(() => {
    if (!journey) return []
    return journey.transactions
      .map((t) => ({
        time: Math.floor(new Date(t.date).getTime() / 1000),
        side: t.type,
        qty: t.quantity,
        price: t.price,
        value: t.quantity * t.price,
      }))
      .filter((m) => m.time)
  }, [journey])

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-80" /></div>
  }

  if (!subject) {
    return (
      <EmptyState
        icon="🔍"
        title="Stock not found"
        message="This security isn't in your holdings or transaction history."
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

      <StockHeader holding={subject} />

      {journey && <StockJourney journey={journey} />}

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
          <PriceChartWithMarkers candles={candles} avgPrice={subject.avgPrice} markers={markers} />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {holding && <PositionSummary holding={holding} />}
        <AthAtlSection holding={subject} stats={stats} />
      </div>

      <PerformanceMetrics holding={subject} stats={stats} />
      <BuySellTimeline transactions={journey?.transactions || []} />
    </div>
  )
}
