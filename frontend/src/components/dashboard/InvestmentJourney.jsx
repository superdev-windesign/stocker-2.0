import { useMemo } from 'react'
import { Card, SectionTitle } from '../common/ui'
import { inr, pct } from '../../analytics/format'

// Builds milestone "story" events from the current portfolio snapshot. Full
// chronological journey needs lifetime transactions (tradebook import later).
function buildMilestones(holdings, orders) {
  if (!holdings.length) return []
  const byPnl = [...holdings].sort((a, b) => b.pnl - a.pnl)
  const byValue = [...holdings].sort((a, b) => b.currentValue - a.currentValue)
  const sectors = new Set(holdings.map((h) => h.sector))
  const totalInvested = holdings.reduce((a, h) => a + h.invested, 0)
  const totalValue = holdings.reduce((a, h) => a + h.currentValue, 0)

  const m = []
  m.push({ icon: '🚀', title: 'Portfolio built', text: `You hold ${holdings.length} stocks across ${sectors.size} sectors, investing ₹${inr(totalInvested)} so far.` })
  m.push({ icon: '🏆', title: 'Biggest position', text: `${byValue[0].symbol} is your largest holding at ₹${inr(byValue[0].currentValue)} (${byValue[0].allocationPct?.toFixed(1) ?? ((byValue[0].currentValue / totalValue) * 100).toFixed(1)}%).` })
  if (byPnl[0]?.pnl > 0)
    m.push({ icon: '📈', title: 'Best winner', text: `${byPnl[0].symbol} is up ₹${inr(byPnl[0].pnl)} (${pct(byPnl[0].pnlPct)}) — your strongest performer.`, tone: 'up' })
  const worst = byPnl[byPnl.length - 1]
  if (worst?.pnl < 0)
    m.push({ icon: '📉', title: 'Toughest hold', text: `${worst.symbol} is down ₹${inr(Math.abs(worst.pnl))} (${pct(worst.pnlPct)}) — your biggest drawdown right now.`, tone: 'down' })
  if (orders?.length) m.push({ icon: '🧾', title: 'Active today', text: `You placed ${orders.length} order(s) today.` })
  m.push({ icon: '💼', title: 'Where you stand', text: `Total portfolio value ₹${inr(totalValue)} — ${totalValue >= totalInvested ? 'ahead of' : 'below'} your ₹${inr(totalInvested)} invested.`, tone: totalValue >= totalInvested ? 'up' : 'down' })
  return m
}

export default function InvestmentJourney({ holdings, orders }) {
  const milestones = useMemo(() => buildMilestones(holdings, orders), [holdings, orders])
  if (!milestones.length) return null

  return (
    <Card className="p-4">
      <SectionTitle
        title="My Investment Journey"
        subtitle="Milestones from your current portfolio · full timeline unlocks with tradebook history"
      />
      <ol className="relative ml-3 border-l border-slate-200 dark:border-white/10">
        {milestones.map((m, i) => (
          <li key={i} className="mb-5 ml-5 last:mb-0">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm ring-1 ring-slate-200 dark:bg-[#12161c] dark:ring-white/10">
              {m.icon}
            </span>
            <h4 className={`text-sm font-semibold ${m.tone === 'up' ? 'text-up' : m.tone === 'down' ? 'text-down' : 'text-slate-800 dark:text-slate-200'}`}>
              {m.title}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">{m.text}</p>
          </li>
        ))}
      </ol>
    </Card>
  )
}
