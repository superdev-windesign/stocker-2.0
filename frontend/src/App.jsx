import { useState } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { PortfolioProvider } from './context/PortfolioContext'
import { AlertsProvider } from './context/AlertsContext'
import { WatchlistProvider } from './context/WatchlistContext'
import { ThemeToggle } from './components/common/ui'
import ErrorBoundary from './components/ErrorBoundary'
import NotificationBell from './components/NotificationBell'
import ProfileMenu from './components/ProfileMenu'
import Login from './routes/Login'
import BrokerConnect from './routes/BrokerConnect'
import PortfolioDashboard from './routes/PortfolioDashboard'
import StockDetail from './routes/StockDetail'
import LivePage from './routes/LivePage'
import Ledger from './routes/Ledger'
import Alerts from './routes/Alerts'
import Tax from './routes/Tax'
import Rebalance from './routes/Rebalance'
import Copilot from './routes/Copilot'

const NAV_LINKS = [
  { to: '/',          label: 'Portfolio', icon: '📊' },
  { to: '/live',      label: 'Live',      icon: '📡' },
  { to: '/ledger',    label: 'Ledger',    icon: '🧾' },
  { to: '/tax',       label: 'Tax',       icon: '🧮' },
  { to: '/rebalance', label: 'Rebalance', icon: '⚖️' },
  { to: '/alerts',    label: 'Alerts',    icon: '🔔' },
]

function NavTab({ to, children, onClick }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

function Layout({ children }) {
  const { demo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-[#0b0e11]/80">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-white/5"
            aria-label="Menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>

          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex shrink-0 items-center gap-2 rounded-lg text-lg font-bold tracking-tight text-slate-900 transition hover:opacity-70 dark:text-slate-100"
          >
            📈 <span className="hidden sm:inline">Stocker</span>
            {demo && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                DEMO
              </span>
            )}
          </button>

          {/* Desktop nav (centered) */}
          <nav className="mx-auto hidden items-center gap-0.5 lg:flex">
            {NAV_LINKS.map((l) => <NavTab key={l.to} to={l.to}>{l.label}</NavTab>)}
          </nav>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <ThemeToggle />
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileOpen && (
          <nav className="grid grid-cols-2 gap-1 border-t border-slate-200 px-4 py-3 lg:hidden dark:border-white/10">
            {NAV_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                  }`
                }
              >
                <span>{l.icon}</span> {l.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>
      </main>
    </div>
  )
}

export default function App() {
  const { user, token, setToken, authError, checking, demo, setDemo, provider } = useAuth()

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  // Not logged into Stocker → show login page.
  if (!user && !demo) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Logged in (or demo) → show the app.
  // The broker token (Paytm) is optional; the app works without it (ledger-only mode).
  return (
    <PortfolioProvider>
      <AlertsProvider>
       <WatchlistProvider>
        <Layout>
          <Routes>
            <Route
              path="/"
              element={provider === 'alphavantage' ? <Navigate to="/live" replace /> : <PortfolioDashboard />}
            />
            <Route path="/copilot"          element={<Copilot />} />
            <Route path="/ledger"           element={<Ledger />} />
            <Route path="/tax"              element={<Tax />} />
            <Route path="/rebalance"        element={<Rebalance />} />
            <Route path="/alerts"           element={<Alerts />} />
            <Route path="/stock/:securityId" element={<StockDetail />} />
            <Route path="/stock/sym/:symbol"  element={<StockDetail />} />
            <Route path="/live"             element={<LivePage />} />
            <Route path="/connect"          element={<BrokerConnect />} />
            <Route path="/login"            element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
       </WatchlistProvider>
      </AlertsProvider>
    </PortfolioProvider>
  )
}
