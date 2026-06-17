import { useMemo } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { summarize, summarizeByCurrency, portfolioCurrencies } from '../analytics/portfolioMetrics'
import { Card, EmptyState, Skeleton } from '../components/common/ui'
import SummaryCards from '../components/dashboard/SummaryCards'
import CountrySplit from '../components/dashboard/CountrySplit'
import HoldingsTable from '../components/dashboard/HoldingsTable'
import AllocationCharts from '../components/dashboard/AllocationCharts'
import PerformanceTimeline from '../components/dashboard/PerformanceTimeline'
import TradeHistory from '../components/dashboard/TradeHistory'
import RealizedProfit from '../components/dashboard/RealizedProfit'
import AdvancedAnalytics from '../components/dashboard/AdvancedAnalytics'
import InvestmentJourney from '../components/dashboard/InvestmentJourney'
import SmartCounts from '../components/dashboard/SmartCounts'
import AIInsights from '../components/dashboard/AIInsights'
import ReentryOpportunities from '../components/dashboard/ReentryOpportunities'
import TopMovers from '../components/dashboard/TopMovers'
import RecentTransactions from '../components/dashboard/RecentTransactions'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

export default function PortfolioDashboard() {
  const { holdings, orders, loading, error, needsLogin } = usePortfolio()
  const summary = useMemo(() => summarize(holdings), [holdings])
  const currencies = useMemo(() => portfolioCurrencies(holdings), [holdings])
  const byCurrency = useMemo(() => summarizeByCurrency(holdings), [holdings])
  const multiCurrency = currencies.length > 1

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  if (needsLogin) {
    return (
      <EmptyState
        icon="🔒"
        title="Session expired"
        message="Your Paytm token isn't active. Log in again to load your portfolio."
        action={
          <a href={`${BACKEND_URL}/api/login`} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
            Login with Paytm
          </a>
        }
      />
    )
  }

  if (error) {
    return <EmptyState icon="⚠️" title="Couldn't load portfolio" message={error} />
  }

  if (!holdings.length) {
    return (
      <EmptyState
        icon="📭"
        title="No holdings found"
        message="Your Paytm account returned no equity holdings. Buy stocks or check that your account has delivery holdings."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Portfolio Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Your complete investment overview · Paytm Money</p>
      </div>

      {multiCurrency ? (
        byCurrency.map((s) => (
          <div key={s.currency}>
            <div className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{s.currency} holdings</div>
            <SummaryCards summary={s} currency={s.currency} />
          </div>
        ))
      ) : (
        <SummaryCards summary={summary} currency={currencies[0] || 'INR'} />
      )}
      <CountrySplit />
      <SmartCounts />
      <AIInsights />
      <AllocationCharts holdings={holdings} />
      <ReentryOpportunities />
      <RealizedProfit />
      <HoldingsTable holdings={holdings} />
      <TopMovers />
      <div className="grid gap-6 xl:grid-cols-2">
        <PerformanceTimeline summary={summary} />
        <RecentTransactions />
      </div>
      <AdvancedAnalytics holdings={holdings} />
      <div className="grid gap-6 xl:grid-cols-2">
        <InvestmentJourney holdings={holdings} orders={orders} />
        <TradeHistory orders={orders} />
      </div>
    </div>
  )
}
