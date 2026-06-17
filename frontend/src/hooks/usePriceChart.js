import { useEffect, useState } from 'react'
import { fetchPriceChart } from '../services/portfolioApi'
import { normalizeCandles } from '../analytics/stockMetrics'
import { useAuth } from '../context/AuthContext'

// Maps a UI timeframe to a Paytm interval + lookback window (days).
const TF = {
  '1D': { interval: '5', days: 1 },
  '1W': { interval: '15', days: 7 },
  '1M': { interval: '60', days: 30 },
  '3M': { interval: 'D', days: 90 },
  '6M': { interval: 'D', days: 182 },
  '1Y': { interval: 'D', days: 365 },
  '5Y': { interval: 'W', days: 365 * 5 },
  Max: { interval: 'M', days: 365 * 20 },
}

export const TIMEFRAMES = Object.keys(TF)

const ymd = (d) => d.toISOString().slice(0, 10)

/**
 * Fetches historical candles for a scrip + timeframe via the backend proxy.
 * Returns normalized candles ready for charts + analytics.
 */
export function usePriceChart(securityId, exchange = 'NSE', timeframe = '1Y') {
  const [candles, setCandles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { provider } = useAuth()

  useEffect(() => {
    if (!securityId) return
    const { interval, days } = TF[timeframe] || TF['1Y']
    const to = new Date()
    const from = new Date(to.getTime() - days * 24 * 3600 * 1000)

    let cancelled = false
    setLoading(true)
    setError(null)
    fetchPriceChart(
      {
        security_id: securityId,
        exchange,
        interval,
        from_date: ymd(from),
        to_date: ymd(to),
      },
      provider || 'paytm',
    )
      .then((raw) => {
        if (!cancelled) setCandles(normalizeCandles(raw))
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [securityId, exchange, timeframe, provider])

  return { candles, loading, error }
}
