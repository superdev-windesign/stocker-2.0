import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolio } from '../../context/PortfolioContext'
import { recentTransactions } from '../../analytics/opportunities'
import { Card, SectionTitle, EmptyState } from '../common/ui'
import { inr, fmtDate } from '../../analytics/format'

// Most recent ledger activity across all stocks (F12).
export default function RecentTransactions() {
  const { transactions, journeyBySymbol } = usePortfolio()
  const navigate = useNavigate()
  const rows = useMemo(() => recentTransactions(transactions || [], 8), [transactions])

  if (!rows.length) {
    return (
      <Card className="p-4">
        <SectionTitle title="Recent Transactions" />
        <EmptyState icon="🧾" title="No transactions yet" message="Add trades in the Ledger to see recent activity." />
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <SectionTitle title="Recent Transactions" subtitle="Latest ledger activity" />
      <ul className="divide-y divide-slate-100 dark:divide-white/5">
        {rows.map((t) => {
          const buy = t.type === 'BUY'
          const sid = t.securityId || journeyBySymbol.get(String(t.symbol).toUpperCase())?.securityId
          return (
            <li
              key={t.id}
              onClick={() => sid && navigate(`/stock/${sid}`)}
              className={`flex items-center justify-between py-2 ${sid ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-6 w-6 shrink-0 rounded-full text-center text-[10px] font-bold leading-6 text-white ${buy ? 'bg-up' : 'bg-down'}`}>
                  {buy ? 'B' : 'S'}
                </span>
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.symbol}</div>
                  <div className="text-xs text-slate-400">{fmtDate(t.date)}</div>
                </div>
              </div>
              <div className="text-right text-sm tabular-nums text-slate-600 dark:text-slate-300">
                {t.quantity} @ ₹{inr(t.price)}
                <div className="text-xs text-slate-400">₹{inr(t.quantity * t.price)}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
