import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts'
import { Card, SectionTitle, StatPill } from '../common/ui'
import { benchmarkSeries, indexed } from '../../data/benchmarks'
import { pct, signClass } from '../../analytics/format'

export default function PerformanceTimeline({ summary }) {
  const { data, niftyReturn, sensexReturn } = useMemo(() => {
    const series = benchmarkSeries()
    const nIdx = indexed(series.map((s) => s.nifty))
    const sIdx = indexed(series.map((s) => s.sensex))
    return {
      data: series.map((s, i) => ({ date: s.date, Nifty: +nIdx[i].toFixed(1), Sensex: +sIdx[i].toFixed(1) })),
      niftyReturn: nIdx[nIdx.length - 1] - 100,
      sensexReturn: sIdx[sIdx.length - 1] - 100,
    }
  }, [])

  const portReturn = summary.totalPnlPct
  const alpha = portReturn != null ? portReturn - niftyReturn : null

  return (
    <Card className="p-4">
      <SectionTitle
        title="Performance vs Market"
        subtitle="Nifty 50 & Sensex indexed to 100 (bundled history). Portfolio time-series needs tradebook."
        right={
          <div className="hidden gap-4 text-right text-xs sm:flex">
            <div>
              <div className="text-slate-500">Your all-time</div>
              <StatPill value={portReturn} />
            </div>
            <div>
              <div className="text-slate-500">Alpha vs Nifty</div>
              <StatPill value={alpha} />
            </div>
          </div>
        }
      />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.12)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={28} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#12161c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#eaecef' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={100} stroke="rgba(127,127,127,0.4)" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="Nifty" stroke="#6366f1" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="Sensex" stroke="#10b981" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Your portfolio is up <span className={signClass(portReturn)}>{pct(portReturn)}</span> all-time vs Nifty{' '}
        <span className={signClass(niftyReturn)}>{pct(niftyReturn)}</span> over the bundled window — alpha{' '}
        <span className={signClass(alpha)}>{pct(alpha)}</span>.
      </p>
    </Card>
  )
}
