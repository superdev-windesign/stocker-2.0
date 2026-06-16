import { Card } from '../common/ui'
import { inrCompact, inr, pct, signClass } from '../../analytics/format'

function Metric({ label, value, sub, subClass, accent }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${accent || 'text-slate-900 dark:text-slate-100'}`}>
        {value}
      </div>
      {sub != null && <div className={`mt-0.5 text-xs tabular-nums ${subClass || 'text-slate-500'}`}>{sub}</div>}
    </Card>
  )
}

export default function SummaryCards({ summary }) {
  const s = summary
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Metric label="Total Investment" value={`₹${inr(s.totalInvested)}`} sub={inrCompact(s.totalInvested)} />
        <Metric label="Current Value" value={`₹${inr(s.currentValue)}`} sub={inrCompact(s.currentValue)} />
        <Metric
          label="Total P&L"
          value={`₹${inr(s.totalPnl)}`}
          accent={signClass(s.totalPnl)}
          sub={pct(s.totalPnlPct)}
          subClass={signClass(s.totalPnlPct)}
        />
        <Metric
          label="Unrealized Gains"
          value={`₹${inr(s.unrealizedGains)}`}
          accent={signClass(s.unrealizedGains)}
        />
        <Metric label="Realized Gains" value="—" sub="needs tradebook" subClass="text-slate-400" />
        <Metric label="Stocks Held" value={s.holdingsCount} />
        <Metric label="Stocks Traded" value="—" sub="needs tradebook" subClass="text-slate-400" />
        <Metric
          label="Day's Change"
          value={`₹${inr(s.dayChangeAbs)}`}
          accent={signClass(s.dayChangeAbs)}
          sub={pct(s.dayChangePct)}
          subClass={signClass(s.dayChangePct)}
        />
        <Metric
          label="Best Performer"
          value={s.best?.symbol || '—'}
          accent="text-up"
          sub={s.best ? pct(s.best.pnlPct) : null}
          subClass="text-up"
        />
        <Metric
          label="Worst Performer"
          value={s.worst?.symbol || '—'}
          accent="text-down"
          sub={s.worst ? pct(s.worst.pnlPct) : null}
          subClass="text-down"
        />
      </div>

      {/* Period returns. Day is real from holdings; longer windows need lifetime history. */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Daily', val: s.dayChangePct, real: true },
          { label: 'Weekly', val: null, real: false },
          { label: 'Monthly', val: null, real: false },
          { label: 'All-time', val: s.totalPnlPct, real: true },
        ].map((p) => (
          <Card key={p.label} className="px-4 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">{p.label}</span>
              <span className={`text-sm font-semibold tabular-nums ${p.real ? signClass(p.val) : 'text-slate-400'}`}>
                {p.real ? pct(p.val) : 'N/A'}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
