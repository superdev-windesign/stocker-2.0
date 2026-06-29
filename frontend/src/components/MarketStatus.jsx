// Live NSE open/closed status + IST clock for the navbar.
import { useEffect, useState } from 'react'

function nseState() {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day = ist.getDay()
  const mins = ist.getHours() * 60 + ist.getMinutes()
  const open = day > 0 && day < 6 && mins >= 555 && mins < 930 // Mon–Fri 9:15–15:30 IST
  const time = ist
    .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toLowerCase()
  return { open, time }
}

export default function MarketStatus() {
  const [s, setS] = useState(nseState)
  useEffect(() => {
    const id = setInterval(() => setS(nseState()), 20_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="hidden items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 sm:flex dark:border-white/10">
      <span className={`h-1.5 w-1.5 rounded-full ${s.open ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
      <span className={`text-xs font-semibold ${s.open ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
        {s.open ? 'NSE Open' : 'NSE Closed'}
      </span>
      <span className="hidden text-xs tabular-nums text-slate-400 md:inline">{s.time}</span>
    </div>
  )
}
