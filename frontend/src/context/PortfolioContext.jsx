import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { fetchHoldings, fetchOrders, fetchFunds } from '../services/portfolioApi'
import { normalizeHoldings } from '../analytics/normalize'
import { DEMO_HOLDINGS, DEMO_ORDERS } from '../data/demoPortfolio'
import { useAuth } from './AuthContext'

const PortfolioContext = createContext(null)

/**
 * Loads holdings/orders/funds once and shares normalized portfolio data across the
 * dashboard so each section doesn't refetch. Surfaces a 401 as `needsLogin`.
 */
export function PortfolioProvider({ children }) {
  const [holdings, setHoldings] = useState([])
  const [orders, setOrders] = useState([])
  const [funds, setFunds] = useState(null)
  const [holdingsValue, setHoldingsValue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  const { demo } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNeedsLogin(false)

    // Demo mode: serve dummy data through the same normalize pipeline, no fetch.
    if (demo) {
      setHoldings(normalizeHoldings(DEMO_HOLDINGS))
      setOrders(DEMO_ORDERS)
      setFunds(null)
      setHoldingsValue(null)
      setLoading(false)
      return
    }

    try {
      const [h, o, f] = await Promise.allSettled([fetchHoldings(), fetchOrders(), fetchFunds()])

      if (h.status === 'fulfilled') {
        setHoldings(normalizeHoldings(h.value))
        setHoldingsValue(h.value?.value || null)
      } else if (h.reason?.status === 401) {
        setNeedsLogin(true)
      } else {
        setError(h.reason?.message || 'Failed to load holdings')
      }

      if (o.status === 'fulfilled') setOrders(extractOrders(o.value))
      if (f.status === 'fulfilled') setFunds(f.value)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [demo])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PortfolioContext.Provider
      value={{ holdings, orders, funds, holdingsValue, loading, error, needsLogin, reload: load }}
    >
      {children}
    </PortfolioContext.Provider>
  )
}

function extractOrders(resp) {
  const arr = resp?.data || resp?.orders || (Array.isArray(resp) ? resp : [])
  return Array.isArray(arr) ? arr : []
}

export const usePortfolio = () => useContext(PortfolioContext)
