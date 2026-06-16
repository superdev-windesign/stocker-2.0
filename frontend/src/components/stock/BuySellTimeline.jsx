import { Card, SectionTitle, EmptyState } from '../common/ui'
import { inr, fmtDate, fmtTime } from '../../analytics/format'

/**
 * Vertical BUY/SELL event timeline. Under API-only this shows today's trades for
 * the stock (if any); the full multi-year timeline needs the tradebook.
 *
 * @param {Array} trades [{ time, side:'BUY'|'SELL', qty, price, value }]
 */
export default function BuySellTimeline({ trades = [] }) {
  if (!trades.length) {
    return (
      <Card className="p-4">
        <SectionTitle title="Buy / Sell Timeline" />
        <EmptyState
          icon="📅"
          title="No transactions in the available window"
          message="Paytm exposes only today's orders. Your full buy/sell timeline for this stock unlocks when you import your tradebook."
        />
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <SectionTitle title="Buy / Sell Timeline" subtitle="Today's transactions for this stock" />
      <ol className="relative ml-3 border-l border-slate-200 dark:border-white/10">
        {trades.map((t, i) => {
          const buy = t.side === 'BUY'
          return (
            <li key={i} className="mb-4 ml-5 last:mb-0">
              <span className={`absolute -left-2.5 mt-1 h-5 w-5 rounded-full text-center text-[10px] font-bold leading-5 text-white ${buy ? 'bg-up' : 'bg-down'}`}>
                {buy ? 'B' : 'S'}
              </span>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${buy ? 'text-up' : 'text-down'}`}>{t.side}</span>
                <span className="text-xs text-slate-400">{fmtDate(t.time)} {fmtTime(t.time)}</span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t.qty} @ ₹{inr(t.price)} = ₹{inr(t.value)}
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
