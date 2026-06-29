// Google Finance-style market chart: Line / Area / Candle / Bar, timeframe selector, Yahoo OHLCV.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { marketChart } from '../../services/marketApi'

const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 }))

// timeframe → Yahoo (interval, range)
const TF = {
  '1D':  { interval: '5m',  range: '1d'  },
  '5D':  { interval: '15m', range: '5d'  },
  '1M':  { interval: '1d',  range: '1mo' },
  '6M':  { interval: '1d',  range: '6mo' },
  'YTD': { interval: '1d',  range: 'ytd' },
  '1Y':  { interval: '1d',  range: '1y'  },
  '5Y':  { interval: '1wk', range: '5y'  },
  'MAX': { interval: '1mo', range: 'max' },
}
const TFS = Object.keys(TF)

// chart-type options with little inline icons
const Icon = ({ type }) => {
  const c = 'h-4 w-4'
  if (type === 'Line') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 17l5-6 4 3 6-8" /></svg>
  if (type === 'Area') return <svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M3 17l5-6 4 3 6-8v11H3z" opacity=".5" /><path d="M3 17l5-6 4 3 6-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
  if (type === 'Candle') return <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 4v4M8 16v4M16 6v3M16 15v3" /><rect x="6" y="8" width="4" height="8" /><rect x="14" y="9" width="4" height="6" /></svg>
  return <svg className={c} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="10" width="3" height="10" /><rect x="10.5" y="5" width="3" height="15" /><rect x="17" y="13" width="3" height="7" /></svg>
}
const TYPES = ['Line', 'Area', 'Candle', 'Bar']

const fmtAxis = (t, tf) => {
  const d = new Date(t * 1000)
  if (tf === '1D' || tf === '5D') return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (tf === '1M' || tf === '6M' || tf === 'YTD') return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

const UP = '#16a34a'
const DOWN = '#dc2626'

// ── Custom candlestick shape (wick high→low + open/close body) ─────────────────
function Candle({ x, y, width, height, payload }) {
  const { open, close, high, low } = payload || {}
  if (high == null || low == null || open == null || close == null) return null
  const range = high - low || 1
  const scale = height / range
  const cx = x + width / 2
  const up = close >= open
  const color = up ? UP : DOWN
  const yOpen = y + (high - open) * scale
  const yClose = y + (high - close) * scale
  const bodyTop = Math.min(yOpen, yClose)
  const bodyH = Math.max(1, Math.abs(yClose - yOpen))
  const bodyW = Math.max(2, width * 0.6)
  return (
    <g>
      <line x1={cx} y1={y} x2={cx} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} />
    </g>
  )
}

// ── Custom OHLC bar shape (high-low line + open tick left, close tick right) ────
function OHLCBar({ x, y, width, height, payload }) {
  const { open, close, high, low } = payload || {}
  if (high == null || low == null || open == null || close == null) return null
  const range = high - low || 1
  const scale = height / range
  const cx = x + width / 2
  const up = close >= open
  const color = up ? UP : DOWN
  const yOpen = y + (high - open) * scale
  const yClose = y + (high - close) * scale
  const tick = Math.max(2, width * 0.35)
  return (
    <g stroke={color} strokeWidth={1.4}>
      <line x1={cx} y1={y} x2={cx} y2={y + height} />
      <line x1={cx - tick} y1={yOpen} x2={cx} y2={yOpen} />
      <line x1={cx} y1={yClose} x2={cx + tick} y2={yClose} />
    </g>
  )
}

function ChartTooltip({ active, payload, type, currency }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const ohlc = type === 'Candle' || type === 'Bar'
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-slate-900">
      <p className="mb-1 font-medium text-slate-500">{new Date(d.t * 1000).toLocaleString('en-IN')}</p>
      {ohlc ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums text-slate-800 dark:text-slate-100">
          <span>O <b>{currency}{fmt(d.open)}</b></span>
          <span>H <b>{currency}{fmt(d.high)}</b></span>
          <span>L <b>{currency}{fmt(d.low)}</b></span>
          <span>C <b>{currency}{fmt(d.close)}</b></span>
        </div>
      ) : (
        <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{currency}{fmt(d.close)}</p>
      )}
    </div>
  )
}

// ── Chart-type dropdown ───────────────────────────────────────────────────────
function TypeDropdown({ type, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
        <Icon type={type} /> {type} <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-white/10 dark:bg-slate-900">
          {TYPES.map((t) => (
            <button key={t} onClick={() => { onChange(t); setOpen(false) }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                t === type ? 'bg-indigo-50 font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5'}`}>
              <Icon type={t} /> {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MarketAreaChart({ symbol, currency = '₹', height = 360 }) {
  const [tf, setTf] = useState('1D')
  const [type, setType] = useState('Area')
  const [data, setData] = useState({ loading: true, candles: [], prevClose: null, error: null })

  useEffect(() => {
    if (!symbol) return
    let off = false
    setData((d) => ({ ...d, loading: true, error: null }))
    const { interval, range } = TF[tf]
    marketChart(symbol, interval, range)
      .then((res) => {
        if (off) return
        const candles = (res?.candles || []).filter((c) => c.close != null)
        setData({ loading: false, candles, prevClose: res?.meta?.prevClose ?? null, error: null })
      })
      .catch((e) => { if (!off) setData({ loading: false, candles: [], prevClose: null, error: e.message }) })
    return () => { off = true }
  }, [symbol, tf])

  const { candles, prevClose } = data
  const first = candles[0]?.close
  const last = candles[candles.length - 1]?.close
  const baseline = tf === '1D' && prevClose != null ? prevClose : first
  const up = last != null && baseline != null ? last >= baseline : true
  const stroke = up ? UP : DOWN
  const ohlc = type === 'Candle' || type === 'Bar'

  const chartData = useMemo(
    () => candles.map((c) => ({ t: c.time, open: c.open, high: c.high, low: c.low, close: c.close })),
    [candles],
  )

  // Candle/Bar need a low→high domain so wicks fit; Line/Area auto-fit close.
  const yDomain = useMemo(() => {
    if (!ohlc) return ['auto', 'auto']
    const lows = candles.map((c) => c.low).filter((v) => v != null)
    const highs = candles.map((c) => c.high).filter((v) => v != null)
    if (!lows.length || !highs.length) return ['auto', 'auto']
    const lo = Math.min(...lows), hi = Math.max(...highs), pad = (hi - lo) * 0.05 || 1
    return [lo - pad, hi + pad]
  }, [candles, ohlc])

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2">
        <TypeDropdown type={type} onChange={setType} />
      </div>

      <div className="relative" style={{ height }}>
        {data.loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
          </div>
        ) : data.error ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Couldn't load chart: {data.error}</div>
        ) : chartData.length < 2 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No chart data for this timeframe.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tickFormatter={(t) => fmtAxis(t, tf)} tick={{ fontSize: 11, fill: '#94a3b8' }}
                minTickGap={48} axisLine={false} tickLine={false} />
              <YAxis domain={yDomain} orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }}
                width={56} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} allowDataOverflow={ohlc} />
              <Tooltip content={<ChartTooltip type={type} currency={currency} />} />
              {!ohlc && baseline != null && (
                <ReferenceLine y={baseline} stroke="#94a3b8" strokeDasharray="3 4" strokeWidth={1}
                  label={{ value: `Prev ${fmt(baseline)}`, position: 'insideBottomRight', fontSize: 10, fill: '#94a3b8' }} />
              )}
              {type === 'Area' && <Area type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} fill="url(#areaFill)" isAnimationActive={false} />}
              {type === 'Line' && <Line type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} dot={false} isAnimationActive={false} />}
              {type === 'Candle' && <Bar dataKey={(d) => [d.low, d.high]} shape={(p) => <Candle {...p} />} isAnimationActive={false} />}
              {type === 'Bar' && <Bar dataKey={(d) => [d.low, d.high]} shape={(p) => <OHLCBar {...p} />} isAnimationActive={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Timeframe buttons */}
      <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-3 dark:border-white/5">
        {TFS.map((k) => (
          <button key={k} onClick={() => setTf(k)}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition ${tf === k
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}
