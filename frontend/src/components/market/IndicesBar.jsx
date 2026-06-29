import { useEffect, useState, useRef } from 'react'
import { marketIndices } from '../../services/marketApi'

const fmt = (n, decimals = 2) =>
  n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

const REFRESH_MS = 30_000

function IndexChip({ index }) {
  const up = (index.changePct ?? 0) >= 0
  const sign = up ? '+' : ''
  const currency = index.region === 'IN' ? '₹' : index.currency === 'USD' ? '' : ''
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold text-slate-300">{index.label || index.symbol}</span>
        <span className="text-xs font-bold tabular-nums text-slate-100">
          {currency}{fmt(index.price, index.region === 'IN' ? 0 : 2)}
        </span>
      </div>
      <div className={`flex flex-col items-end text-right ${up ? 'text-emerald-400' : 'text-red-400'}`}>
        <span className="text-[10px] tabular-nums">{sign}{fmt(index.change, 2)}</span>
        <span className="text-[11px] font-semibold tabular-nums">{sign}{fmt(index.changePct, 2)}%</span>
      </div>
    </div>
  )
}

function SentimentBadge({ label, avgPct }) {
  const cfg = {
    Bullish: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', icon: '▲' },
    Bearish: { bg: 'bg-red-500/15 border-red-500/30',         text: 'text-red-400',     icon: '▼' },
    Neutral: { bg: 'bg-slate-500/15 border-white/10',         text: 'text-slate-400',   icon: '●' },
    Unknown: { bg: 'bg-slate-500/15 border-white/10',         text: 'text-slate-500',   icon: '?' },
  }
  const c = cfg[label] || cfg.Unknown
  return (
    <div className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 ${c.bg}`}>
      <span className={`text-xs ${c.text}`}>{c.icon}</span>
      <div className="flex flex-col">
        <span className={`text-[11px] font-semibold ${c.text}`}>{label}</span>
        <span className="text-[10px] text-slate-500">
          {avgPct != null ? `avg ${avgPct > 0 ? '+' : ''}${fmt(avgPct, 2)}%` : 'market'}
        </span>
      </div>
    </div>
  )
}

export default function IndicesBar() {
  const [state, setState] = useState({ loading: true, indices: [], sentiment: null, error: null })
  const timerRef = useRef(null)

  const load = async () => {
    try {
      const data = await marketIndices()
      const indices = Array.isArray(data) ? data : []

      // Derive sentiment from indices data locally (no separate round-trip).
      const scores = indices.map((d) => d.changePct ?? 0).filter((v) => v !== null)
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      const up = scores.filter((s) => s > 0.3).length
      const down = scores.filter((s) => s < -0.3).length
      const sentimentLabel = up >= 4 ? 'Bullish' : down >= 4 ? 'Bearish' : 'Neutral'

      setState({ loading: false, indices, sentiment: { label: sentimentLabel, avgPct: avg }, error: null })
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }))
    }
  }

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, REFRESH_MS)
    return () => clearInterval(timerRef.current)
  }, [])

  if (state.loading) {
    return (
      <div className="flex h-12 items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#13161b] px-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-7 w-24 shrink-0 animate-pulse rounded-lg bg-white/10" />
        ))}
      </div>
    )
  }

  if (state.error && !state.indices.length) {
    return (
      <div className="flex h-10 items-center rounded-xl border border-white/10 bg-[#13161b] px-4 text-xs text-slate-500">
        Market indices unavailable · {state.error}
      </div>
    )
  }

  const india = state.indices.filter((d) => d.region === 'IN')
  const us    = state.indices.filter((d) => d.region !== 'IN')

  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-white/10 bg-[#13161b] px-4 py-2 scrollbar-none">
      {/* Sentiment badge */}
      {state.sentiment && (
        <>
          <SentimentBadge label={state.sentiment.label} avgPct={state.sentiment.avgPct} />
          <div className="h-8 w-px shrink-0 bg-white/10" />
        </>
      )}

      {/* India indices */}
      {india.length > 0 && (
        <>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-600">IN</span>
          {india.map((idx) => <IndexChip key={idx.symbol} index={idx} />)}
          {us.length > 0 && <div className="h-8 w-px shrink-0 bg-white/10" />}
        </>
      )}

      {/* US indices */}
      {us.length > 0 && (
        <>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-600">US</span>
          {us.map((idx) => <IndexChip key={idx.symbol} index={idx} />)}
        </>
      )}
    </div>
  )
}
