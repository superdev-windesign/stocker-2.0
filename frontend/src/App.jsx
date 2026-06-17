import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { PortfolioProvider } from './context/PortfolioContext'
import { AlertsProvider } from './context/AlertsContext'
import { ThemeToggle } from './components/common/ui'
import ErrorBoundary from './components/ErrorBoundary'
import NotificationBell from './components/NotificationBell'
import TokenGate from './components/TokenGate'
import PortfolioDashboard from './routes/PortfolioDashboard'
import StockDetail from './routes/StockDetail'
import LivePage from './routes/LivePage'
import Ledger from './routes/Ledger'
import Alerts from './routes/Alerts'
import Tax from './routes/Tax'

function NavTab({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function Layout({ children }) {
  const { logout, demo, setDemo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-[#0b0e11]/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100"
          >
            📈 Stocker
            {demo && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                DEMO
              </span>
            )}
          </button>
          <nav className="flex items-center gap-1">
            <NavTab to="/">Portfolio</NavTab>
            <NavTab to="/ledger">Ledger</NavTab>
            <NavTab to="/tax">Tax</NavTab>
            <NavTab to="/alerts">Alerts</NavTab>
            <NavTab to="/live">Live</NavTab>
          </nav>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setDemo(!demo)}
              title="Toggle demo data"
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                demo
                  ? 'border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400'
                  : 'border-slate-200 text-slate-600 hover:border-slate-400 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/30'
              }`}
            >
              🎭 Demo
            </button>
            <ThemeToggle />
            <button
              onClick={logout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-400 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/30"
            >
              {demo ? 'Exit' : 'Logout'}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>
      </main>
    </div>
  )
}

export default function App() {
  const { token, setToken, authError, checking, demo, setDemo } = useAuth()

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading session…
      </div>
    )
  }

  if (!token && !demo) {
    return <TokenGate onConnect={setToken} onDemo={() => setDemo(true)} error={authError} />
  }

  return (
    <PortfolioProvider>
      <AlertsProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<PortfolioDashboard />} />
            <Route path="/ledger" element={<Ledger />} />
            <Route path="/tax" element={<Tax />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/stock/:securityId" element={<StockDetail />} />
            <Route path="/live" element={<LivePage />} />
          </Routes>
        </Layout>
      </AlertsProvider>
    </PortfolioProvider>
  )
}
