import { useEffect, useRef, useState } from 'react'

const fmt = (n) =>
  n == null ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function StockCard({ stock, quote, selected, onSelect }) {
  const ltp = quote?.last_price
  const changeAbs = quote?.change_absolute
  const changePct = quote?.change_percent
  const up = (changeAbs ?? 0) >= 0

  // Flash the card briefly whenever the price changes.
  const [flashKey, setFlashKey] = useState(0)
  const prevLtp = useRef(ltp)
  useEffect(() => {
    if (ltp != null && ltp !== prevLtp.current) {
      prevLtp.current = ltp
      setFlashKey((k) => k + 1)
    }
  }, [ltp])

  return (
    <button
      onClick={() => onSelect(stock)}
      className={`text-left rounded-xl border bg-[#12161c] p-4 transition ${
        selected ? 'border-indigo-500 ring-1 ring-indigo-500/40' : 'border-white/10 hover:border-white/25'
      }`}
    >
      <div key={flashKey} className={flashKey ? 'animate-flash rounded-md' : ''}>
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">{stock.symbol}</span>
          <span className="text-[10px] uppercase tracking-wide text-gray-500">NSE</span>
        </div>
        <div className="truncate text-xs text-gray-500">{stock.name}</div>

        <div className="mt-3 text-2xl font-bold tabular-nums">
          {ltp == null ? <span className="text-gray-600">—</span> : <>₹{fmt(ltp)}</>}
        </div>

        <div className={`mt-1 text-sm font-medium tabular-nums ${up ? 'text-up' : 'text-down'}`}>
          {changeAbs == null ? (
            <span className="text-gray-600">awaiting ticks…</span>
          ) : (
            <>
              {up ? '▲' : '▼'} {fmt(Math.abs(changeAbs))} ({up ? '+' : '-'}
              {fmt(Math.abs(changePct))}%)
            </>
          )}
        </div>
      </div>
    </button>
  )
}
