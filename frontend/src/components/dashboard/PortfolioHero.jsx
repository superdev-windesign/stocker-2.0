// Clean portfolio summary band — merges the old SummaryCards + LifetimeSummary + SmartCounts.
// Shows live value/P&L up top, real metrics in a grid, and lifetime counts below.
import { Card } from '../common/ui'
import { money, pct, signClass } from '../../analytics/format'

function Stat({ label, value, sub, tone }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 truncate text-base font-bold tabular-nums ${tone || 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
      {sub != null && <p className={`text-[11px] tabular-nums ${tone || 'text-slate-400'}`}>{sub}</p>}
    </div>
  )
}

function Pill({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 px-4 py-2 text-right dark:border-white/10">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

export default function PortfolioHero({ summary: s, lifetime: lt, currency = 'INR' }) {
  return (
    <Card className="p-5">
      {/* Headline: current value + P&L / today pills */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Current value</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{money(s.currentValue, currency)}</p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Invested {money(s.totalInvested, currency)}</p>
        </div>
        <div className="flex gap-2">
          <Pill label="Total P&L" value={`${money(s.totalPnl, currency)} · ${pct(s.totalPnlPct)}`} tone={signClass(s.totalPnl)} />
          <Pill label="Today" value={`${money(s.dayChangeAbs, currency)} · ${pct(s.dayChangePct)}`} tone={signClass(s.dayChangeAbs)} />
        </div>
      </div>

      {/* Real metric grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Invested" value={money(s.totalInvested, currency)} />
        <Stat label="Current value" value={money(s.currentValue, currency)} />
        <Stat label="Unrealized P&L" value={money(s.unrealizedGains, currency)} tone={signClass(s.unrealizedGains)} />
        {lt
          ? <Stat label="Realized P&L" value={money(lt.realized, currency)} tone={signClass(lt.realized)} sub="booked" />
          : <Stat label="Realized P&L" value="—" sub="needs ledger" />}
        {lt
          ? <Stat label="Net P&L (all-time)" value={money(lt.netPnl, currency)} tone={signClass(lt.netPnl)} sub={pct(lt.returnPct)} />
          : <Stat label="Total return" value={pct(s.totalPnlPct)} tone={signClass(s.totalPnlPct)} />}
        <Stat label="Day's change" value={money(s.dayChangeAbs, currency)} tone={signClass(s.dayChangeAbs)} sub={pct(s.dayChangePct)} />
      </div>

      {/* Counts + best/worst */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span><b className="text-slate-700 dark:text-slate-200">{s.holdingsCount}</b> held</span>
        {lt && <span><b className="text-slate-700 dark:text-slate-200">{lt.exited}</b> exited</span>}
        {lt && <span><b className="text-up">{lt.winners}</b> winners · <b className="text-down">{lt.losers}</b> losers</span>}
        {s.best && <span>Best <b className="text-up">{s.best.symbol}</b> {pct(s.best.pnlPct)}</span>}
        {s.worst && <span>Worst <b className="text-down">{s.worst.symbol}</b> {pct(s.worst.pnlPct)}</span>}
      </div>
    </Card>
  )
}
