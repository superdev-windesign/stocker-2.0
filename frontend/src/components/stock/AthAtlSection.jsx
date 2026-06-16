import { Card, SectionTitle } from '../common/ui'
import { inr, pct, fmtDate, signClass } from '../../analytics/format'

export default function AthAtlSection({ holding, stats }) {
  const aa = stats?.athAtl
  if (!aa) {
    return (
      <Card className="p-4">
        <SectionTitle title="All-Time High / Low" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Price history unavailable for this stock.</p>
      </Card>
    )
  }

  const ltp = holding.lastPrice
  const fromAth = aa.ath ? ((ltp - aa.ath) / aa.ath) * 100 : null
  const fromAtl = aa.atl ? ((ltp - aa.atl) / aa.atl) * 100 : null
  // Position of LTP within the ATL..ATH band (0-100%).
  const band = aa.ath - aa.atl
  const posPct = band > 0 ? Math.max(0, Math.min(100, ((ltp - aa.atl) / band) * 100)) : 50

  const ifBoughtAtl = holding.quantity * (ltp - aa.atl)
  const ifSoldAth = holding.quantity * (aa.ath - holding.avgPrice)

  return (
    <Card className="p-4">
      <SectionTitle
        title="All-Time High / Low"
        subtitle={`Within available history (${fmtDate(aa.rangeStart)} – ${fmtDate(aa.rangeEnd)})`}
      />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="All-Time High" value={`₹${inr(aa.ath)}`} sub={fmtDate(aa.athDate)} extra={<>Distance: <span className={signClass(fromAth)}>{pct(fromAth)}</span></>} />
        <Stat label="All-Time Low" value={`₹${inr(aa.atl)}`} sub={fmtDate(aa.atlDate)} extra={<>Distance: <span className={signClass(fromAtl)}>{pct(fromAtl)}</span></>} />
      </div>

      {/* LTP position within the ATL..ATH range */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>ATL ₹{inr(aa.atl)}</span>
          <span>Now ₹{inr(ltp)}</span>
          <span>ATH ₹{inr(aa.ath)}</span>
        </div>
        <div className="relative h-2 rounded-full bg-gradient-to-r from-down/40 via-amber-400/40 to-up/40">
          <div className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded bg-slate-900 dark:bg-white" style={{ left: `${posPct}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Insight label="If you'd bought at ATL" value={ifBoughtAtl} note="unrealized vs today" />
        <Insight label="If you'd sold at ATH" value={ifSoldAth} note="vs your avg buy" />
      </div>
    </Card>
  )
}

function Stat({ label, value, sub, extra }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-xs text-slate-400">{sub}</div>
      <div className="mt-1 text-xs">{extra}</div>
    </div>
  )
}

function Insight({ label, value, note }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-white/5">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${signClass(value)}`}>₹{inr(value)}</div>
      <div className="text-xs text-slate-400">{note}</div>
    </div>
  )
}
