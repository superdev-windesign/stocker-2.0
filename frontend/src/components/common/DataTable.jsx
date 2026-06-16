import { useMemo, useState } from 'react'
import Papa from 'papaparse'

/**
 * Generic, theme-aware data table with search, column sort, pagination and CSV export.
 *
 * @param {Array<{key,label,align?,render?,sortable?,csv?}>} columns
 * @param {Array<object>} rows
 * @param {(row)=>void} [onRowClick]
 * @param {string} [searchKeys]  which row fields to search (defaults to all string/number fields)
 * @param {string} [csvName]
 */
export default function DataTable({
  columns,
  rows,
  onRowClick,
  searchKeys,
  csvName = 'export.csv',
  pageSize = 10,
  initialSort,
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(initialSort || null) // { key, dir }
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.toLowerCase()
    const keys = searchKeys || columns.map((c) => c.key)
    return rows.filter((r) => keys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)))
  }, [rows, query, searchKeys, columns])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const { key, dir } = sort
    const mult = dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult
      return String(av ?? '').localeCompare(String(bv ?? '')) * mult
    })
  }, [filtered, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const pageRows = sorted.slice(current * pageSize, current * pageSize + pageSize)

  const toggleSort = (key) =>
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' },
    )

  const exportCsv = () => {
    const data = sorted.map((r) => {
      const o = {}
      for (const c of columns) o[c.label] = c.csv ? c.csv(r) : r[c.key]
      return o
    })
    const blob = new Blob([Papa.unparse(data)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = csvName
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          placeholder="Search…"
          className="w-48 rounded-lg border border-slate-200 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-white/10"
        />
        <button
          onClick={exportCsv}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30"
        >
          ⬇ Export CSV
        </button>
      </div>

      <div className="thin-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.sortable !== false && toggleSort(c.key)}
                  className={`whitespace-nowrap px-3 py-2 font-medium ${
                    c.align === 'right' ? 'text-right' : ''
                  } ${c.sortable !== false ? 'cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200' : ''}`}
                >
                  {c.label}
                  {sort?.key === c.key && (sort.dir === 'asc' ? ' ▲' : ' ▼')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr
                key={r.id ?? i}
                onClick={() => onRowClick?.(r)}
                className={`border-b border-slate-100 dark:border-white/5 ${
                  onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5' : ''
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`whitespace-nowrap px-3 py-2.5 tabular-nums ${
                      c.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {!pageRows.length && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">
                  No matching rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {sorted.length} rows · page {current + 1}/{pageCount}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-white/10"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current >= pageCount - 1}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-white/10"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
