import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchWatchlists, createWatchlist as apiCreate, deleteWatchlist as apiDelete,
  addToWatchlist as apiAdd, removeFromWatchlist as apiRemove,
} from '../services/watchlistApi'
import { useAuth } from './AuthContext'

const Ctx = createContext(null)

export function WatchlistProvider({ children }) {
  const { user } = useAuth()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!user) { setLists([]); return }
    setLoading(true)
    try { setLists(await fetchWatchlists()) } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { reload() }, [reload])

  // Create a list; optionally seed it with an item in the same flow. Returns the new list.
  const createList = useCallback(async (name, seedItem = null) => {
    const created = await apiCreate(name)
    if (seedItem && created?.id) {
      try { await apiAdd(created.id, seedItem) } catch { /* ignore */ }
    }
    await reload()
    return created
  }, [reload])

  const removeList = useCallback(async (id) => {
    await apiDelete(id)
    await reload()
  }, [reload])

  // Toggle a symbol in a list (add if absent, remove if present).
  const toggleItem = useCallback(async (listId, item, present) => {
    if (present) await apiRemove(listId, item.symbol)
    else await apiAdd(listId, item)
    await reload()
  }, [reload])

  // Which list-ids currently contain this symbol?
  const listsContaining = useCallback(
    (symbol) => new Set(lists.filter((l) => l.items.some((it) => it.symbol === String(symbol).toUpperCase())).map((l) => l.id)),
    [lists],
  )

  const value = useMemo(
    () => ({ lists, loading, reload, createList, removeList, toggleItem, listsContaining }),
    [lists, loading, reload, createList, removeList, toggleItem, listsContaining],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useWatchlists = () => useContext(Ctx)
