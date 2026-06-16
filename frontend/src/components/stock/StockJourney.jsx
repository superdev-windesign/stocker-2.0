import { Card, SectionTitle } from '../common/ui'
import { inr, pct, fmtDate, signClass } from '../../analytics/format'

// One labelled value tile.
function Stat({ label, value, sub, tone }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${tone || 'text-slate-900 dark:text-slate-100'}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

const fmtDays = (d) => {
  if (d == null) return '—'
  if (d < 60) return `${d} days`
  if (d < 365) return `${Math.round(d / 30)} months`
  return `${(d / 365).toFixed(1)} years`
}

/**
 * Complete Stock Journey — current status + lifecycle summary (F1) and full
 * trade analytics (F3). Driven entirely by the FIFO journey object.
 */
export default function StockJourney({ journey }) {
  if (!journey) return null
  const j = journey
  const holding = j.status === 'HOLDING'
  const exited = j.status === 'EXITED'

  return (
    <Card className="p-4">
      <SectionTitle
        title="Stock Journey"
        subtitle="Your complete history with this stock"
        right={
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              holding
                ? 'bg-up/10 text-up'
                : exited
                  ? 'bg-amber-400/15 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-400/15 text-slate-500'
            }`}
          >
            {holding ? '● Currently Holding' : exited ? '○ Fully Sold' : 'No position'}
          </span>
        }
      />

      {/* Lifecycle summary (F1) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="First Purchase" value={fmtDate(j.firstBuyDate)} />
        <Stat label="Last Purchase" value={fmtDate(j.lastBuyDate)} />
        <Stat label="First Sell" value={fmtDate(j.firstSellDate)} />
        <Stat label="Last Sell" value={fmtDate(j.lastSellDate)} />
        <Stat label="Holding Duration" value={fmtDays(j.holdingDays)} />

        <Stat label="Times Bought" value={j.timesBought} />
        <Stat label="Times Sold" value={j.timesSold} />
        <Stat label="Total Investment" value={`₹${inr(j.totalInvestment)}`} />
        <Stat label="Total Exit Value" value={`₹${inr(j.totalExitValue)}`} />
        <Stat
          label="Total Return"
          value={pct(j.totalReturnPct)}
          tone={signClass(j.totalReturnPct)}
        />

        <Stat
          label="Realized Profit"
          value={`₹${inr(j.realizedPnl)}`}
          tone={signClass(j.realizedPnl)}
        />
        <Stat
          label="Unrealized Profit"
          value={j.unrealizedPnl == null ? '—' : `₹${inr(j.unrealizedPnl)}`}
          tone={signClass(j.unrealizedPnl)}
        />
      </div>

      {/* Trade analytics (F3) */}
      <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-700 dark:text-slate-300">Trade Analytics</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Avg Buy Price" value={`₹${inr(j.avgBuyPrice)}`} sub={holding ? 'remaining lots' : 'lifetime'} />
        <Stat label="Avg Sell Price" value={j.avgSellPrice == null ? '—' : `₹${inr(j.avgSellPrice)}`} />
        <Stat label="Highest Buy" value={j.highestBuy == null ? '—' : `₹${inr(j.highestBuy)}`} />
        <Stat label="Lowest Buy" value={j.lowestBuy == null ? '—' : `₹${inr(j.lowestBuy)}`} />
        <Stat label="Highest Sell" value={j.highestSell == null ? '—' : `₹${inr(j.highestSell)}`} />
        <Stat label="Lowest Sell" value={j.lowestSell == null ? '—' : `₹${inr(j.lowestSell)}`} />
        <Stat label="Shares Bought" value={j.totalBoughtQty} />
        <Stat label="Shares Sold" value={j.totalSoldQty} />
        <Stat label="Current Shares Held" value={j.currentQty} tone={holding ? 'text-up' : undefined} />
        <Stat label="Current Price" value={j.lastPrice == null ? '—' : `₹${inr(j.lastPrice)}`} />
        <Stat
          label="Current Value"
          value={j.currentValue == null ? '—' : `₹${inr(j.currentValue)}`}
        />
        <Stat
          label="Last Sell Price"
          value={j.lastSellPrice == null ? '—' : `₹${inr(j.lastSellPrice)}`}
        />
      </div>
    </Card>
  )
}
