import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { fetchHoldings, fetchOrders, fetchFunds } from '../services/portfolioApi'
import {
  fetchTransactions,
  createTransaction,
  updateTransactionApi,
  deleteTransactionApi,
  importTransactionsApi,
} from '../services/ledgerApi'
import { normalizeHoldingsFor } from '../analytics/normalize'
import { buildAllJourneys } from '../analytics/ledger'
import {
  DEMO_HOLDINGS,
  DEMO_ORDERS,
  DEMO_TRANSACTIONS,
  DEMO_EXITED_PRICES,
  DEMO_US_HOLDINGS,
  DEMO_US_TRANSACTIONS,
} from '../data/demoPortfolio'
import { useAuth } from './AuthContext'

const PortfolioContext = createContext(null)

let demoIdSeq = 1
const demoId = () => `demo-${demoIdSeq++}`

/**
 * Loads holdings/orders/funds + the lifetime transaction ledger, and derives a
 * per-stock "journey" (FIFO realized/unrealized P&L, dates, status). Shared across
 * the app so sections don't refetch. Surfaces a 401 as `needsLogin`.
 */
export function PortfolioProvider({ children }) {
  const [holdings, setHoldings] = useState([])
  const [orders, setOrders] = useState([])
  const [funds, setFunds] = useState(null)
  const [holdingsValue, setHoldingsValue] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  const { demo, provider } = useAuth()
  const activeProvider = provider || 'paytm'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNeedsLogin(false)

    // Demo mode: serve dummy data through the same pipeline, no fetch.
    if (demo) {
      setHoldings([...normalizeHoldingsFor('paytm', DEMO_HOLDINGS), ...DEMO_US_HOLDINGS])
      setOrders(DEMO_ORDERS)
      setTransactions(
        [...DEMO_TRANSACTIONS, ...DEMO_US_TRANSACTIONS].map((tx) => ({ ...tx, id: demoId(), createdAt: tx.date })),
      )
      setFunds(null)
      setHoldingsValue(null)
      setLoading(false)
      return
    }

    try {
      const [h, o, f, tx] = await Promise.allSettled([
        fetchHoldings(activeProvider),
        fetchOrders(activeProvider),
        fetchFunds(activeProvider),
        fetchTransactions(),
      ])

      if (h.status === 'fulfilled') {
        setHoldings(normalizeHoldingsFor(activeProvider, h.value))
        setHoldingsValue(h.value?.value || null)
      } else if (h.reason?.status === 401) {
        setNeedsLogin(true)
      } else {
        setError(h.reason?.message || 'Failed to load holdings')
      }

      if (o.status === 'fulfilled') setOrders(extractOrders(o.value))
      if (f.status === 'fulfilled') setFunds(f.value)
      if (tx.status === 'fulfilled') setTransactions(Array.isArray(tx.value) ? tx.value : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [demo, activeProvider])

  useEffect(() => {
    load()
  }, [load])

  // Reload only the ledger (after a mutation), leaving holdings/quotes untouched.
  const reloadTransactions = useCallback(async () => {
    if (demo) return
    try {
      const list = await fetchTransactions()
      setTransactions(Array.isArray(list) ? list : [])
    } catch (e) {
      setError(e.message)
    }
  }, [demo])

  // ── Ledger mutations (demo edits local state; live hits the API then refetches) ──
  const addTxn = useCallback(
    async (tx) => {
      if (demo) {
        setTransactions((prev) => [...prev, { ...tx, id: demoId(), createdAt: new Date().toISOString() }])
        return
      }
      await createTransaction(tx)
      await reloadTransactions()
    },
    [demo, reloadTransactions],
  )

  const editTxn = useCallback(
    async (id, tx) => {
      if (demo) {
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...tx } : t)))
        return
      }
      await updateTransactionApi(id, tx)
      await reloadTransactions()
    },
    [demo, reloadTransactions],
  )

  const removeTxn = useCallback(
    async (id) => {
      if (demo) {
        setTransactions((prev) => prev.filter((t) => t.id !== id))
        return
      }
      await deleteTransactionApi(id)
      await reloadTransactions()
    },
    [demo, reloadTransactions],
  )

  const importTxns = useCallback(
    async (rows) => {
      if (demo) {
        setTransactions((prev) => [
          ...prev,
          ...rows.map((tx) => ({ ...tx, id: demoId(), createdAt: new Date().toISOString() })),
        ])
        return { added: rows.length }
      }
      const res = await importTransactionsApi(rows)
      await reloadTransactions()
      return res
    },
    [demo, reloadTransactions],
  )

  // Derived: one journey per distinct symbol across the whole ledger.
  const journeys = useMemo(
    () => buildAllJourneys(transactions, holdings, demo ? DEMO_EXITED_PRICES : {}),
    [transactions, holdings, demo],
  )

  const journeyBySymbol = useMemo(() => {
    const m = new Map()
    for (const j of journeys) m.set(String(j.symbol).toUpperCase(), j)
    return m
  }, [journeys])

  return (
    <PortfolioContext.Provider
      value={{
        holdings,
        orders,
        funds,
        holdingsValue,
        transactions,
        journeys,
        journeyBySymbol,
        loading,
        error,
        needsLogin,
        reload: load,
        reloadTransactions,
        addTxn,
        editTxn,
        removeTxn,
        importTxns,
      }}
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
