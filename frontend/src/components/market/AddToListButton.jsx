// "Add to list" dropdown — matches Google Finance: checkbox per list, + New list, Done.
// `item` = { symbol, yahooSymbol, name, exchange, type, country }
import { useEffect, useRef, useState } from 'react'
import { useWatchlists } from '../../context/WatchlistContext'

export default function AddToListButton({ item, compact = false }) {
  const { lists, createList, toggleItem, listsContaining } = useWatchlists()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setCreating(false) } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const inLists = listsContaining(item.symbol)
  const added = inLists.size > 0

  const onToggle = async (list) => {
    setBusy(true)
    try { await toggleItem(list.id, item, inLists.has(list.id)) } finally { setBusy(false) }
  }

  const onCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    try {
      await createList(name, item)   // create the list AND add this stock to it
      setNewName(''); setCreating(false)
    } finally { setBusy(false) }
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      {compact ? (
        <button
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
          title={added ? 'In a list' : 'Add to list'}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-base leading-none transition ${
            added
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-500 dark:border-white/20 dark:text-slate-400'
          }`}
        >
          {added ? '✓' : '+'}
        </button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
            added
              ? 'bg-indigo-600 text-white hover:bg-indigo-500'
              : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5'
          }`}
        >
          {added ? '✓ Added' : '+ Add to list'}
          <span className="text-[10px]">{open ? '▲' : '▼'}</span>
        </button>
      )}

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-slate-900">
          <div className="max-h-64 overflow-auto">
            {lists.length === 0 && !creating && (
              <p className="px-3 py-4 text-center text-xs text-slate-400">No lists yet. Create one below.</p>
            )}
            {lists.map((l) => {
              const checked = inLists.has(l.id)
              return (
                <button
                  key={l.id} disabled={busy} onClick={() => onToggle(l)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-white/5"
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded border ${
                    checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-white/20'
                  }`}>
                    {checked && <span className="text-[11px]">✓</span>}
                  </span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{l.name}</span>
                  <span className="ml-auto text-[11px] text-slate-400">{l.items.length}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-1 border-t border-slate-100 pt-2 dark:border-white/10">
            {creating ? (
              <div className="flex items-center gap-2 px-1">
                <input
                  autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onCreate()}
                  placeholder="List name…"
                  className="flex-1 rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-white/15"
                />
                <button onClick={onCreate} disabled={busy || !newName.trim()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                  Add
                </button>
              </div>
            ) : (
              <button onClick={() => setCreating(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
                <span className="text-base leading-none">+</span> New list
              </button>
            )}
            <button onClick={() => { setOpen(false); setCreating(false) }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20">
              ✓ Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
