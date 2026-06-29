import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { useAuth } from '../context/AuthContext'
import { summarize, summarizeByCurrency, portfolioCurrencies } from '../analytics/portfolioMetrics'
import { lifetimeSummary } from '../analytics/opportunities'

const MARKET_FILTERS = [
  { id: 'all', label: '🌐 All' },
  { id: 'IN',  label: '🇮🇳 India' },
  { id: 'US',  label: '🇺🇸 US' },
]
import { EmptyState, Skeleton } from '../components/common/ui'
import PortfolioHero from '../components/dashboard/PortfolioHero'
import PortfolioValueChart from '../components/dashboard/PortfolioValueChart'
import PortfolioNews from '../components/dashboard/PortfolioNews'
import CountrySplit from '../components/dashboard/CountrySplit'
import HoldingsTable from '../components/dashboard/HoldingsTable'
import AllocationCharts from '../components/dashboard/AllocationCharts'
import PerformanceTimeline from '../components/dashboard/PerformanceTimeline'
import TradeHistory from '../components/dashboard/TradeHistory'
import RealizedProfit from '../components/dashboard/RealizedProfit'
import AdvancedAnalytics from '../components/dashboard/AdvancedAnalytics'
import InvestmentJourney from '../components/dashboard/InvestmentJourney'
import RiskDashboard from '../components/dashboard/RiskDashboard'
import AIInsights from '../components/dashboard/AIInsights'
import ReentryOpportunities from '../components/dashboard/ReentryOpportunities'
import TopMovers from '../components/dashboard/TopMovers'
import RecentTransactions from '../components/dashboard/RecentTransactions'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

const PROVIDER_LABEL = { paytm: 'Paytm Money', indmoney: 'INDstocks', alphavantage: 'AlphaVantage', csv: 'CSV Import' }

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'holdings',  label: 'Holdings' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'activity',  label: 'Activity' },
]

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
  const { holdings, orders, journeys, transactions, loading, error, needsLogin } = usePortfolio()
  const { provider } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [marketFilter, setMarketFilter] = useState('all')
  const activeProvider = provider || 'paytm'
  const providerLabel = PROVIDER_LABEL[activeProvider] || activeProvider

  // Show market filter only when both India and US holdings exist
  const hasMultipleMarkets = useMemo(() => {
    const countries = new Set(holdings.map((h) => h.country || 'IN'))
    return countries.size > 1
  }, [holdings])

  // Filter holdings by selected market
  const filteredHoldings = useMemo(() => {
    if (marketFilter === 'all') return holdings
    return holdings.filter((h) => (h.country || 'IN') === marketFilter)
  }, [holdings, marketFilter])

  // Symbol → country map (from holdings + transactions) so exited stocks filter correctly too
  const symbolCountry = useMemo(() => {
    const map = {}
    for (const t of (transactions || [])) if (t.symbol) map[t.symbol.toUpperCase()] = t.country || 'IN'
    for (const h of holdings) map[h.symbol.toUpperCase()] = h.country || 'IN'
    return map
  }, [holdings, transactions])

  const filteredJourneys = useMemo(() => {
    if (marketFilter === 'all') return journeys
    return (journeys || []).filter((j) => (symbolCountry[j.symbol?.toUpperCase()] || 'IN') === marketFilter)
  }, [journeys, marketFilter, symbolCountry])

  const summary = useMemo(() => summarize(filteredHoldings), [filteredHoldings])
  const currencies = useMemo(() => portfolioCurrencies(filteredHoldings), [filteredHoldings])
  const byCurrency = useMemo(() => summarizeByCurrency(filteredHoldings), [filteredHoldings])
  const lifetimeGroups = useMemo(() => lifetimeSummary(filteredJourneys || []), [filteredJourneys])
  const lifetimeFor = (cur) => lifetimeGroups.find((g) => g.currency === cur) || null

  const activeCountry = marketFilter === 'all' ? undefined : marketFilter

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-10 w-80" />
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Portfolio</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Your investment overview · {providerLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Market filter — only when India + US holdings both exist */}
          {hasMultipleMarkets && (
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
              {MARKET_FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setMarketFilter(id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    marketFilter === id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {activeProvider === 'csv' && (
            <button onClick={() => navigate('/connect')} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700">
              Upload more
            </button>
          )}
        </div>
      </div>

      {/* Hero summary — one per currency (usually just one) */}
      {(byCurrency.length ? byCurrency : [{ ...summary, currency: currencies[0] || 'INR' }]).map((s) => (
        <div key={s.currency}>
          {byCurrency.length > 1 && (
            <p className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{s.currency} holdings</p>
          )}
          <PortfolioHero summary={s} lifetime={lifetimeFor(s.currency)} currency={s.currency} />
        </div>
      ))}

      {/* Portfolio equity curve + accurate period returns (reconstructed from ledger) */}
      <PortfolioValueChart currency={currencies[0] || 'INR'} country={activeCountry} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id
                ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <AllocationCharts holdings={filteredHoldings} />
          <PortfolioNews country={activeCountry} />
          {/* Country split only makes sense in the "All" view */}
          {marketFilter === 'all' && <CountrySplit />}
          <div className="grid gap-5 xl:grid-cols-2">
            <PerformanceTimeline summary={summary} />
            <TopMovers journeys={filteredJourneys} />
          </div>
        </div>
      )}

      {tab === 'holdings' && (
        <div className="space-y-5">
          <HoldingsTable holdings={filteredHoldings} />
          <RealizedProfit />
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-5">
          <RiskDashboard />
          <AdvancedAnalytics holdings={filteredHoldings} />
          <AIInsights />
          <ReentryOpportunities />
        </div>
      )}

      {tab === 'activity' && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <RecentTransactions />
            <TradeHistory orders={orders} />
          </div>
          <InvestmentJourney holdings={filteredHoldings} orders={orders} />
        </div>
      )}
    </div>
  )
}
