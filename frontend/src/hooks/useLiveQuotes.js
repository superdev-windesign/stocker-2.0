import { useEffect, useRef, useState } from 'react'
import { createPaytmSocket } from '../services/paytmSocket'
import { PREFERENCES } from '../config/stocks'

const MAX_HISTORY = 300

/**
 * Manages the Paytm websocket for a given token and exposes live quote state.
 *
 * @param {string|null} token  public access token; null/empty means "not connected yet"
 * @returns {{
 *   status: string,                 // 'idle' | 'connecting' | 'connected' | 'error' | 'closed'
 *   error: string|null,
 *   quotes: Record<number, object>, // security_id -> latest tick
 *   history: Record<number, Array<{time:number, value:number}>>
 * }}
 */
export function useLiveQuotes(token) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [quotes, setQuotes] = useState({})
  const [history, setHistory] = useState({})

  // Keep one point per second per security to keep the chart readable.
  const lastPointTime = useRef({})

  useEffect(() => {
    if (!token) {
      setStatus('idle')
      return
    }

    setError(null)
    setQuotes({})
    setHistory({})
    lastPointTime.current = {}

    const conn = createPaytmSocket({
      token,
      preferences: PREFERENCES,
      onStatus: (s, detail) => {
        setStatus(s)
        if (s === 'error') setError(detail || 'Unknown error')
      },
      onTick: (ticks) => {
        setQuotes((prev) => {
          const next = { ...prev }
          for (const t of ticks) next[t.security_id] = t
          return next
        })

        setHistory((prev) => {
          const next = { ...prev }
          for (const t of ticks) {
            // lightweight-charts wants UNIX seconds, strictly ascending.
            const sec = t.last_trade_time || Math.floor(Date.now() / 1000)
            if (lastPointTime.current[t.security_id] === sec) continue
            lastPointTime.current[t.security_id] = sec

            const series = next[t.security_id] ? [...next[t.security_id]] : []
            series.push({ time: sec, value: t.last_price })
            if (series.length > MAX_HISTORY) series.shift()
            next[t.security_id] = series
          }
          return next
        })
      },
    })

    return () => conn.disconnect()
  }, [token])

  return { status, error, quotes, history }
}
