import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio } from '../context/PortfolioContext'
import { taxSummary, unrealizedIfSold, currentFY, TAX_RATES } from '../analytics/tax'
import { Card, SectionTitle, EmptyState } from '../components/common/ui'
import { money, signClass, fmtDate } from '../analytics/format'

const inr = (n) => money(n, 'INR')

function Stat({ label, value, sub, tone }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 text-base font-bold tabular-nums ${tone || 'text-slate-900 dark:text-slate-100'}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

export default function Tax() {
  const { journeys } = usePortfolio()
  const navigate = useNavigate()
  const fy = currentFY()
  const sum = useMemo(() => taxSummary(journeys || []), [journeys])
  const unreal = useMemo(() => unrealizedIfSold(journeys || []), [journeys])
  const { realized, harvest, harvestableLoss, offset, estSaving, ltReadiness } = sum

  const hasAny = (journeys || []).some((j) => (j.currency || 'INR') === 'INR' && (j.realizedLots?.length || j.openLots?.length))

  if (!hasAny) {
    return (
      <div className="space-y-6">
        <SectionTitle title="Tax Optimization" subtitle="India equity capital gains — estimates from your ledger" />
        <EmptyState icon="🧮" title="No Indian equity activity yet" message="Add buys/sells (or sync from Paytm) to see capital-gains tax, harvesting, and LTCG readiness." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Tax Optimization"
        subtitle={`India equity capital gains · ${fy.label} (Apr–Mar) · estimates, not tax advice`}
      />

      {/* Realized capital gains this FY */}
      <Card className="p-4">
        <SectionTitle title={`Realized Capital Gains · ${fy.label}`} subtitle="From sells booked this financial year" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Short-term gain" value={inr(realized.stGain)} tone={signClass(realized.stGain)} sub={`taxed ${TAX_RATES.STCG_RATE * 100}%`} />
          <Stat label="Long-term gain" value={inr(realized.ltGain)} tone={signClass(realized.ltGain)} sub={`${TAX_RATES.LTCG_RATE * 100}% over ₹1.25L`} />
          <Stat label="LTCG exemption used" value={inr(realized.ltExemptionUsed)} sub="of ₹1,25,000" />
          <Stat label="STCG tax" value={inr(realized.stTax)} tone="text-down" />
          <Stat label="LTCG tax" value={inr(realized.ltTax)} tone="text-down" />
          <Stat label="Estimated tax due" value={inr(realized.totalTax)} tone="text-down" sub="this FY" />
        </div>
      </Card>

      {/* Tax-loss harvesting */}
      <Card className="p-4">
        <SectionTitle title="Tax-Loss Harvesting" subtitle="Book losses to offset realized gains" />
        {harvest.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No holdings currently at a loss to harvest.</p>
        ) : (
          <>
            {realized.totalTax > 0 && offset > 0 && (
              <p className="mb-3 rounded-lg bg-up/10 px-3 py-2 text-sm text-up">
                You have {inr(realized.stGain + realized.ltGain)} of realized gains. Harvesting up to {inr(-harvestableLoss)} of
                losses could offset {inr(offset)} — an estimated saving of <b>{inr(estSaving)}</b>.
              </p>
            )}
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {harvest.map((h) => (
                <li
                  key={h.symbol}
                  onClick={() => navigate(h.securityId ? `/stock/${h.securityId}` : `/stock/sym/${encodeURIComponent(h.symbol)}`)}
                  className="flex cursor-pointer items-center justify-between py-2 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{h.symbol}</span>
                  <span className="text-sm tabular-nums text-down">{inr(h.unrealizedLoss)} <span className="text-xs text-slate-400">({h.qty} sh)</span></span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* LTCG readiness */}
      <Card className="p-4">
        <SectionTitle title="Long-Term Readiness" subtitle="Holdings about to cross 1 year — hold to drop from 20% to 12.5%" />
        {ltReadiness.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No lots nearing the 1-year long-term mark in the next 90 days.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {ltReadiness.map((r, i) => (
              <li
                key={`${r.symbol}-${i}`}
                onClick={() => navigate(r.securityId ? `/stock/${r.securityId}` : `/stock/sym/${encodeURIComponent(r.symbol)}`)}
                className="flex cursor-pointer items-center justify-between py-2 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.symbol}</div>
                  <div className="text-xs text-slate-400">bought {fmtDate(r.buyDate)} · {r.qty} sh</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-indigo-500">Hold {r.daysToLT} more days</div>
                  {r.potentialSaving > 0 && <div className="text-xs text-up">save ~{inr(r.potentialSaving)} tax</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Unrealized if sold now */}
      <Card className="p-4">
        <SectionTitle title="If You Sold Everything Today" subtitle="Hypothetical tax on current holdings" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Short-term gain" value={inr(unreal.stGain)} tone={signClass(unreal.stGain)} />
          <Stat label="Long-term gain" value={inr(unreal.ltGain)} tone={signClass(unreal.ltGain)} />
          <Stat label="Estimated tax" value={inr(unreal.totalTax)} tone="text-down" />
          <Stat label="Open lots" value={unreal.lots.length} />
        </div>
      </Card>

      <p className="text-xs text-slate-400">
        Estimates for listed Indian equity (STT-paid), post-23-Jul-2024 rates. Excludes surcharge/cess, set-off of carried-forward
        losses, and non-INR holdings. Not tax advice — verify with a professional before filing.
      </p>
    </div>
  )
}
