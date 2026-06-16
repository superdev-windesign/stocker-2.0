import { Card, SectionTitle, EmptyState } from '../common/ui'

export default function RealizedProfit() {
  const stats = ['Total Realized Gains', 'Total Realized Losses', 'Win Rate %', 'Avg Holding Period']
  return (
    <Card className="p-4">
      <SectionTitle title="Realized Profit Analysis" subtitle="Closed positions (sold stocks)" />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
            <div className="text-xs text-slate-500 dark:text-slate-400">{s}</div>
            <div className="mt-0.5 text-lg font-bold text-slate-400">—</div>
          </div>
        ))}
      </div>
      <EmptyState
        icon="💰"
        title="Realized P&L needs your trade history"
        message="Paytm's API doesn't expose sold-stock history, so realized gains, win rate and holding periods can't be computed yet. Import your Paytm P&L / Tradebook statement to unlock this."
        action={
          <button disabled className="mt-3 cursor-not-allowed rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-400 dark:border-white/10">
            Import P&L statement (coming soon)
          </button>
        }
      />
    </Card>
  )
}
