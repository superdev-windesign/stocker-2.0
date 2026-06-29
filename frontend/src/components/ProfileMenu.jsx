// Account + settings dropdown in the navbar. Consolidates user info, broker status,
// theme, demo mode, and logout into one clean menu.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

function Row({ icon, label, value, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-white/5 ${
        danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      <span className="w-4 text-center text-base leading-none">{icon}</span>
      <span className="flex-1">{label}</span>
      {value && <span className="text-xs font-medium text-slate-400">{value}</span>}
    </button>
  )
}

export default function ProfileMenu() {
  const { user, token, logout, demo, setDemo } = useAuth()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const name = user?.name || user?.email || 'Guest'
  const initial = name.trim()[0]?.toUpperCase() || 'U'

  const go = (path) => { setOpen(false); navigate(path) }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Account & settings"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white ring-2 ring-transparent transition hover:ring-indigo-300 dark:hover:ring-indigo-500/40"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#12161c]">
          {/* Account header */}
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{initial}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.name || 'Stocker user'}</p>
              <p className="truncate text-xs text-slate-400">{user?.email || (demo ? 'Demo session' : '')}</p>
            </div>
          </div>

          <div className="my-1 h-px bg-slate-100 dark:bg-white/10" />

          {/* Broker connection */}
          <Row
            icon={token ? '🟢' : '⚪'}
            label="Broker"
            value={token ? 'Connected' : 'Connect'}
            onClick={() => go('/connect')}
          />

          {/* Theme toggle (keeps menu open) */}
          <Row
            icon={theme === 'dark' ? '🌙' : '☀️'}
            label="Theme"
            value={theme === 'dark' ? 'Dark' : 'Light'}
            onClick={toggle}
          />

          {/* Demo mode toggle (keeps menu open) */}
          <Row
            icon="🎭"
            label="Demo data"
            value={demo ? 'On' : 'Off'}
            onClick={() => setDemo(!demo)}
          />

          <div className="my-1 h-px bg-slate-100 dark:bg-white/10" />

          <Row icon="↩" label={demo ? 'Exit demo' : 'Log out'} onClick={() => { setOpen(false); logout() }} danger />
        </div>
      )}
    </div>
  )
}
