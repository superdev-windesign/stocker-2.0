import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio } from '../../context/PortfolioContext'
import { topProfit, topLoss } from '../../analytics/opportunities'
import { Card, SectionTitle, StatPill } from '../common/ui'
import { inr } from '../../analytics/format'

function MoverList({ title, subtitle, rows, navigate, empty }) {
  return (
    <Card className="p-4">
      <SectionTitle title={title} subtitle={subtitle} />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((j) => (
            <li
              key={j.symbol}
              onClick={() => navigate(j.securityId ? `/stock/${j.securityId}` : `/stock/sym/${encodeURIComponent(j.symbol)}`)}
              className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{j.symbol}</div>
                <div className="truncate text-xs text-slate-400">
                  {j.status === 'EXITED' ? 'Fully sold' : 'Holding'} · realized ₹{inr(j.realizedPnl)}
                </div>
              </div>
              <div className="ml-3 text-right">
                <div className={`text-sm font-semibold tabular-nums ${j.totalPnl >= 0 ? 'text-up' : 'text-down'}`}>
                  ₹{inr(j.totalPnl)}
                </div>
                <StatPill value={j.totalReturnPct} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// Lifetime top profit / top loss across the whole ledger (F12).
export default function TopMovers({ journeys: journeysProp }) {
  const { journeys: journeysCtx } = usePortfolio()
  const journeys = journeysProp ?? journeysCtx
  const navigate = useNavigate()
  const winners = useMemo(() => topProfit(journeys || [], 5), [journeys])
  const losers = useMemo(() => topLoss(journeys || [], 5), [journeys])

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <MoverList title="Top Profit Makers" subtitle="Lifetime P&L (realized + unrealized)" rows={winners} navigate={navigate} empty="No profitable stocks yet." />
      <MoverList title="Top Losers" subtitle="Lifetime P&L (realized + unrealized)" rows={losers} navigate={navigate} empty="No losing stocks — nice." />
    </div>
  )
}
