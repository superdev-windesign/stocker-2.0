// Shared, theme-aware UI primitives used across the dashboard.
import { useTheme } from '../../context/ThemeContext'

// Surface card.
export function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#12161c] ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

// Small colored pill for +/- values.
export function StatPill({ value, suffix = '%', className = '' }) {
  const n = Number(value)
  const up = n >= 0
  if (value == null || Number.isNaN(n))
    return <span className={`text-slate-400 ${className}`}>—</span>
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
        up ? 'bg-up/10 text-up' : 'bg-down/10 text-down'
      } ${className}`}
    >
      {up ? '▲' : '▼'} {Math.abs(n).toFixed(2)}
      {suffix}
    </span>
  )
}

export function EmptyState({ icon = '📄', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center dark:border-white/10">
      <div className="text-3xl">{icon}</div>
      <h3 className="mt-2 font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-white/10 ${className}`} />
}

// Segmented timeframe control.
export function Timeframe({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === o
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title="Toggle theme"
      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm transition hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
