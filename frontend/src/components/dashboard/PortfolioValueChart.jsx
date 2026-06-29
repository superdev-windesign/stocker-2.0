// Portfolio value over time (reconstructed from the ledger) + accurate period returns.
import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, SectionTitle, Skeleton } from '../common/ui'
import { money, moneyCompact } from '../../analytics/format'
import { portfolioHistory } from '../../services/marketApi'

const TFS = [['1M', 30], ['3M', 90], ['6M', 182], ['1Y', 365]]
const WINDOWS = [['1W', 7], ['1M', 30], ['3M', 90], ['6M', 182], ['1Y', 365]]

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })

// % change of value from the point on/before `target` date to the latest point.
function returnSince(series, days) {
  if (series.length < 2) return null
  const last = series[series.length - 1]
  const target = daysAgo(days)
  let start = null
  for (const p of series) { if (p.date <= target) start = p; else break }
  start = start || series[0]
  if (!start || !start.value) return null
  return ((last.value - start.value) / start.value) * 100
}

const Pct = ({ v }) => {
  if (v == null) return <span className="text-slate-400">—</span>
  const up = v >= 0
  return <span className={up ? 'text-emerald-500' : 'text-red-500'}>{up ? '+' : ''}{v.toFixed(2)}%</span>
}

export default function PortfolioValueChart({ currency = 'INR', country }) {
  const [series, setSeries] = useState(null) // null=loading, []=none
  const [tf, setTf] = useState(365)

  useEffect(() => {
    let off = false
    setSeries(null)
    portfolioHistory('1y', country || undefined)
      .then((d) => { if (!off) setSeries(Array.isArray(d?.series) ? d.series : []) })
      .catch(() => { if (!off) setSeries([]) })
    return () => { off = true }
  }, [country])

  const shown = useMemo(() => {
    if (!series) return []
    const from = daysAgo(tf)
    const s = series.filter((p) => p.date >= from)
    return s.length >= 2 ? s : series // fall back to full if window too short
  }, [series, tf])

  if (series === null) return <Card className="p-4"><Skeleton className="h-72" /></Card>
  if (series.length < 2) {
    return (
      <Card className="p-4">
        <SectionTitle title="Portfolio value" subtitle="Equity curve over time" />
        <p className="py-10 text-center text-sm text-slate-400">
          Not enough price history yet to chart your portfolio. Add a tradebook with dated trades to see the curve.
        </p>
      </Card>
    )
  }

  const latest = series[series.length - 1]
  const up = shown.length >= 2 ? shown[shown.length - 1].value >= shown[0].value : true
  const stroke = up ? '#16a34a' : '#dc2626'

  return (
    <Card className="p-4">
      <SectionTitle
        title="Portfolio value"
        subtitle={`Now ${money(latest.value, currency)} · invested ${money(latest.invested, currency)}`}
        right={
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
            {TFS.map(([label, days]) => (
              <button
                key={label} onClick={() => setTf(days)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  tf === days ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >{label}</button>
            ))}
          </div>
        }
      />

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={shown} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={56} axisLine={false} tickLine={false} />
            <YAxis domain={['auto', 'auto']} orientation="right" width={64} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => moneyCompact(v, currency)} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              labelFormatter={fmtDate}
              formatter={(v, key) => [money(v, currency), key === 'value' ? 'Value' : 'Invested']}
            />
            <Line type="monotone" dataKey="invested" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 4" dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} fill="url(#pvFill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Accurate period returns from the equity curve */}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-5 dark:border-white/5">
        {WINDOWS.map(([label, days]) => (
          <div key={label} className="text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-sm font-semibold tabular-nums"><Pct v={returnSince(series, days)} /></p>
          </div>
        ))}
      </div>
    </Card>
  )
}
