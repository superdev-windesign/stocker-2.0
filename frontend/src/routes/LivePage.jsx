import { useState } from 'react'
import { STOCKS } from '../config/stocks'
import { useLiveQuotes } from '../hooks/useLiveQuotes'
import { useAuth } from '../context/AuthContext'
import ConnectionBadge from '../components/ConnectionBadge'
import StockCard from '../components/StockCard'
import PriceChart from '../components/PriceChart'

export default function LivePage() {
  const { token } = useAuth()
  const [selected, setSelected] = useState(STOCKS[0])
  const { status, error, quotes, history } = useLiveQuotes(token)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Live Nifty 50
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Streaming · Paytm Money LTP</p>
        </div>
        <ConnectionBadge status={status} error={error} />
      </div>

      {status === 'error' && error && (
        <div className="mb-4 rounded-lg border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STOCKS.map((stock) => (
          <StockCard
            key={stock.scripId}
            stock={stock}
            quote={quotes[Number(stock.scripId)]}
            selected={selected.scripId === stock.scripId}
            onSelect={setSelected}
          />
        ))}
      </section>

      <section className="mt-6">
        <PriceChart stock={selected} data={history[Number(selected.scripId)]} />
      </section>
    </div>
  )
}
