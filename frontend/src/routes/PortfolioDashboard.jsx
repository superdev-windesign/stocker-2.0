import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { summarize, summarizeByCurrency, portfolioCurrencies } from '../analytics/portfolioMetrics'
import { Card, EmptyState, Skeleton } from '../components/common/ui'
import SummaryCards from '../components/dashboard/SummaryCards'
import LifetimeSummary from '../components/dashboard/LifetimeSummary'
import CountrySplit from '../components/dashboard/CountrySplit'
import HoldingsTable from '../components/dashboard/HoldingsTable'
import AllocationCharts from '../components/dashboard/AllocationCharts'
import PerformanceTimeline from '../components/dashboard/PerformanceTimeline'
import TradeHistory from '../components/dashboard/TradeHistory'
import RealizedProfit from '../components/dashboard/RealizedProfit'
import AdvancedAnalytics from '../components/dashboard/AdvancedAnalytics'
import InvestmentJourney from '../components/dashboard/InvestmentJourney'
import SmartCounts from '../components/dashboard/SmartCounts'
import RiskDashboard from '../components/dashboard/RiskDashboard'
import AIInsights from '../components/dashboard/AIInsights'
import ReentryOpportunities from '../components/dashboard/ReentryOpportunities'
import TopMovers from '../components/dashboard/TopMovers'
import RecentTransactions from '../components/dashboard/RecentTransactions'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

const PROVIDER_LABEL = { paytm: 'Paytm Money', indmoney: 'INDstocks', alphavantage: 'AlphaVantage', csv: 'CSV Import' }

function CsvFallback({ label = 'or use CSV tradebook instead' }) {
  const { setProvider } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="mt-4 flex flex-col items-center gap-1">
      <span className="text-xs text-slate-400">or</span>
      <button
        onClick={() => { setProvider('csv'); navigate('/') }}
        className="text-sm text-indigo-500 hover:text-indigo-400 hover:underline"
      >
        {label}
      </button>
    </div>
  )
}

export default function PortfolioDashboard() {
  const { holdings, orders, loading, error, needsLogin } = usePortfolio()
  const { provider } = useAuth()
  const navigate = useNavigate()
  const activeProvider = provider || 'paytm'
  const providerLabel = PROVIDER_LABEL[activeProvider] || activeProvider

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
    const isPaytm = activeProvider === 'paytm'
    return (
      <EmptyState
        icon="🔒"
        title="Broker session expired"
        message={`Your ${providerLabel} token isn't active. Reconnect your broker to load live holdings.`}
        action={
          <div className="flex flex-col items-center">
            {isPaytm ? (
              <a href={`${BACKEND_URL}/api/login`} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                Reconnect Paytm
              </a>
            ) : (
              <button onClick={() => navigate('/connect')} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                Reconnect {providerLabel}
              </button>
            )}
            <CsvFallback label="use uploaded CSV portfolio instead" />
          </div>
        }
      />
    )
  }

  if (error) {
    return (
      <EmptyState
        icon="⚠️"
        title="Couldn't load portfolio"
        message={error}
        action={
          <button onClick={() => navigate('/connect')} className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300">
            Manage broker connections
          </button>
        }
      />
    )
  }

  if (!holdings.length) {
    if (activeProvider === 'csv') {
      return (
        <EmptyState
          icon="📂"
          title="No transactions imported yet"
          message="Upload your tradebook CSV or Excel file to build your portfolio. Any broker export works — Zerodha, Paytm, Groww, Upstox."
          action={
            <button onClick={() => navigate('/connect')} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              Upload tradebook
            </button>
          }
        />
      )
    }
    return (
      <EmptyState
        icon="📭"
        title="No holdings found"
        message={`${providerLabel} returned no equity holdings. Check that your account has delivery positions.`}
        action={<CsvFallback label="upload tradebook CSV instead" />}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Portfolio Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Your complete investment overview · {providerLabel}</p>
      </div>

      {activeProvider === 'csv' && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-2.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Portfolio derived from uploaded tradebook · live prices via Yahoo Finance
          </p>
          <button
            onClick={() => navigate('/connect')}
            className="ml-3 shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Upload more
          </button>
        </div>
      )}

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
      <LifetimeSummary />
      <CountrySplit />
      <SmartCounts />
      <RiskDashboard />
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
