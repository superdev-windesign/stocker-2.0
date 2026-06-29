import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePortfolio } from '../context/PortfolioContext'
import { importTransactionsApi } from '../services/ledgerApi'
import { parseTradebookFile } from '../analytics/tradebook'
import { PROVIDER_LIST } from '../config/providers'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  return res
}

// ── Broker provider card (Paytm, INDmoney) ────────────────────────────────────
function ProviderCard({ provider, status, onConnect, onDisconnect }) {
  const connected = status?.connected
  return (
    <div className={`rounded-xl border p-5 transition ${connected ? 'border-emerald-500/40 bg-emerald-500/5 dark:border-emerald-500/30' : 'border-slate-200 dark:border-white/10'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{provider.flag}</span>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{provider.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{provider.markets}</div>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${connected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-500'}`}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {connected && status.generated_at && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Connected {new Date(status.generated_at).toLocaleDateString()}
            {status.expires_at && ` · expires ${new Date(status.expires_at).toLocaleDateString()}`}
          </p>
          {connected && status.tokenValid === false && (
            <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
              Token rejected by broker — {status.tokenError || 'unable to validate'}. Disconnect and paste a fresh token.
            </p>
          )}
          {connected && status.tokenValid === true && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">✓ Token is valid and accepting requests</p>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {!connected ? (
          <button
            onClick={() => onConnect(provider)}
            disabled={!provider.available}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            Connect
          </button>
        ) : (
          <button
            onClick={() => onDisconnect(provider)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Disconnect
          </button>
        )}
        {!provider.available && (
          <span className="self-center text-xs text-slate-400">Not available in this deployment</span>
        )}
      </div>
    </div>
  )
}

// ── CSV upload card ────────────────────────────────────────────────────────────
function CsvUploadCard({ onActivated }) {
  const { setProvider, provider: activeProvider } = useAuth()
  const [status, setStatus] = useState({ checking: true, count: 0, connected: false })
  const [preview, setPreview] = useState(null) // { rows, fileName }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  // Check if we already have derived holdings (transactions imported)
  const probe = useCallback(async () => {
    try {
      const r = await apiFetch('/api/holdings/derived')
      if (r.ok) {
        const data = await r.json()
        const count = Array.isArray(data) ? data.length : 0
        setStatus({ checking: false, count, connected: count > 0 })
      } else {
        setStatus({ checking: false, count: 0, connected: false })
      }
    } catch {
      setStatus({ checking: false, count: 0, connected: false })
    }
  }, [])

  useEffect(() => { probe() }, [probe])

  const handleFile = useCallback(async (file) => {
    if (!file) return
    setError('')
    setMsg('')
    try {
      const { rows, headers, broker, rawCount } = await parseTradebookFile(file)
      if (!rows.length) {
        const headerList = headers.length
          ? `Detected columns: ${headers.slice(0, 8).join(', ')}${headers.length > 8 ? '…' : ''}`
          : 'No header row found'
        setError(
          `No valid rows parsed from "${file.name}" (${rawCount} raw rows, broker detected: ${broker || 'unknown'}).\n` +
          `${headerList}.\n` +
          `The parser needs columns for: Date · Symbol · Type (BUY/SELL) · Quantity · Price.\n` +
          `See the format guide below to rename your columns.`
        )
        return
      }
      setPreview({ rows, headers, broker, fileName: file.name })
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const onFileInput = (e) => { handleFile(e.target.files?.[0]); if (fileRef.current) fileRef.current.value = '' }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const confirmImport = async () => {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      const res = await importTransactionsApi(preview.rows)
      const added = res?.added ?? preview.rows.length
      const skipped = res?.skipped ?? 0
      const parts = [`${added} transactions imported`]
      if (skipped) parts.push(`${skipped} already existed (skipped)`)
      if (res?.replacedBaseline) parts.push(`${res.replacedBaseline} baseline entries replaced`)
      setPreview(null)
      // Activate CSV mode immediately — don't wait for Yahoo Finance quotes.
      // The portfolio will load derived holdings in the background once we navigate.
      setProvider('csv')
      setMsg(parts.join(' · ') + '.')
      setStatus({ checking: false, count: added, connected: added > 0 })
      if (added > 0) {
        onActivated?.()
      } else {
        setError('Import completed but no new transactions were added. Your file may already be fully imported.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isActive = activeProvider === 'csv'

  return (
    <div className={`rounded-xl border p-5 transition ${(status.connected || isActive) ? 'border-emerald-500/40 bg-emerald-500/5 dark:border-emerald-500/30' : 'border-dashed border-slate-300 dark:border-white/10'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📂</span>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">Upload CSV / Excel tradebook</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Zerodha · Paytm · Groww · Upstox · any broker export</div>
          </div>
        </div>
        {status.checking ? (
          <span className="text-xs text-slate-400">Checking…</span>
        ) : status.connected ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            {status.count} holdings derived
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-white/5 dark:text-slate-500">
            No data yet
          </span>
        )}
      </div>

      {/* Status messages */}
      {status.connected && !msg && (
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          ✓ Portfolio is built from your uploaded transactions. Upload a newer tradebook anytime to update.
          {isActive && ' · CSV mode active.'}
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">✓ {msg}</p>}

      {/* Drag-and-drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${dragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 hover:border-indigo-400 dark:border-white/10 dark:hover:border-indigo-500/50'}`}
        onClick={() => fileRef.current?.click()}
      >
        <span className="text-3xl">📥</span>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {dragging ? 'Drop file here' : 'Drag & drop or click to select'}
        </p>
        <p className="text-xs text-slate-400">Accepts .csv, .xlsx, .xls from any broker</p>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={onFileInput} className="hidden" />
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 dark:bg-red-900/20">
          {error.split('\n').map((line, i) => (
            <p key={i} className={`text-xs ${i === 0 ? 'font-medium text-red-700 dark:text-red-400' : 'mt-0.5 text-red-600 dark:text-red-500'}`}>{line}</p>
          ))}
        </div>
      )}

      {/* Format guide — always visible */}
      <details className="mt-3 group">
        <summary className="cursor-pointer text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 select-none">
          Format guide &amp; supported column names ▸
        </summary>
        <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Download a guaranteed-working sample</p>
            <a
              href="/sample-tradebook.csv"
              download="sample-tradebook.csv"
              className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
            >
              ⬇ sample-tradebook.csv
            </a>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Column name aliases (case &amp; spaces ignored)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
              <div><span className="font-medium text-slate-800 dark:text-slate-200">Date:</span> Date · Trade Date · Order Date · Transaction Date</div>
              <div><span className="font-medium text-slate-800 dark:text-slate-200">Symbol:</span> Symbol · Script · Scrip · Trading Symbol · Security · Stock · Instrument</div>
              <div><span className="font-medium text-slate-800 dark:text-slate-200">Type:</span> Type · Trade Type · Transaction Type · Action · Buy or Sell</div>
              <div><span className="font-medium text-slate-800 dark:text-slate-200">Quantity:</span> Quantity · Qty · Trade Qty · Net Qty · Filled Qty</div>
              <div><span className="font-medium text-slate-800 dark:text-slate-200">Price:</span> Price · Trade Price · Avg Price · Average Price · Net Rate</div>
              <div><span className="font-medium text-slate-800 dark:text-slate-200">Exchange:</span> Exchange · Market · Segment (optional)</div>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Where to export from each broker</p>
            <ul className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              <li><span className="font-medium text-slate-700 dark:text-slate-300">Zerodha</span> — Console → Reports → Tradebook → download CSV</li>
              <li><span className="font-medium text-slate-700 dark:text-slate-300">Paytm Money</span> — Reports → Statements → Trade Book → CSV/Excel</li>
              <li><span className="font-medium text-slate-700 dark:text-slate-300">Groww</span> — Account → P&amp;L → Securities → download (use "Transaction History", NOT P&amp;L summary)</li>
              <li><span className="font-medium text-slate-700 dark:text-slate-300">Upstox</span> — P&amp;L → Trade details → Export CSV</li>
              <li><span className="font-medium text-slate-700 dark:text-slate-300">Angel One</span> — Portfolio → Trade History → Export</li>
            </ul>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">If your format still fails</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-500">
              Open the CSV in Excel or Google Sheets. Rename the header row to use the exact aliases above
              (e.g. rename "Average Price" → "Price", "No. of Shares" → "Quantity", "Transaction" → "Type").
              Keep BUY/SELL values as-is. Save as CSV and re-upload.
            </p>
          </div>
        </div>
      </details>

      {status.connected && !isActive && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => { setProvider('csv'); onActivated?.() }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Use CSV portfolio
          </button>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#13161b] p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-100">
              Import {preview.rows.length} transactions
            </h2>
            <p className="mb-1 text-sm text-slate-400">
              Found <strong className="text-slate-200">{preview.rows.length}</strong> valid rows in{' '}
              <strong className="text-slate-200">{preview.fileName}</strong>.
              Duplicate trade IDs are skipped automatically.
            </p>
            {preview.broker && (
              <p className="mb-3 text-xs text-indigo-400">Detected format: {preview.broker}</p>
            )}
            {/* Sample rows */}
            <div className="mb-4 max-h-40 overflow-auto rounded-lg bg-white/5 p-3 font-mono text-xs text-slate-300">
              {preview.rows.slice(0, 8).map((r, i) => (
                <div key={i} className="py-0.5">
                  <span className="text-slate-500">{r.date}</span>
                  {' · '}
                  <span className={r.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>{r.type}</span>
                  {' · '}
                  <span className="text-slate-200">{r.symbol}</span>
                  {' × '}
                  <span>{r.quantity}</span>
                  {' @ ₹'}
                  <span>{r.price}</span>
                </div>
              ))}
              {preview.rows.length > 8 && (
                <div className="pt-1 text-slate-500">… and {preview.rows.length - 8} more</div>
              )}
            </div>
            {error && (
              <p className="mb-3 text-xs text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={confirmImport}
                disabled={busy}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? 'Importing…' : `Import ${preview.rows.length} transactions`}
              </button>
              <button
                onClick={() => { setPreview(null); setError('') }}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function BrokerConnect() {
  const { setToken, setProvider } = useAuth()
  const { reload } = usePortfolio()
  const navigate = useNavigate()
  const [statuses, setStatuses] = useState({})
  const [pasteToken, setPasteToken] = useState('')
  const [pasteTarget, setPasteTarget] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Probe each broker provider: check token existence + live API validation.
  useEffect(() => {
    async function probe() {
      const results = {}
      for (const p of PROVIDER_LIST) {
        if (p.auth === 'explore' || p.auth === 'csv') { results[p.id] = { connected: false }; continue }
        const tokenPath = p.id === 'indmoney' ? '/api/indmoney/token/retrieve' : '/api/token/retrieve'
        const holdingsPath = p.id === 'indmoney' ? '/api/indmoney/holdings' : '/api/holdings'
        try {
          const r = await apiFetch(tokenPath)
          if (r.ok) {
            const d = await r.json()
            if (d?.public_access_token) {
              const hRes = await apiFetch(holdingsPath)
              results[p.id] = {
                connected: true,
                tokenValid: hRes.ok,
                tokenError: !hRes.ok ? (await hRes.json().catch(() => ({}))).error : null,
                ...d,
              }
            } else {
              results[p.id] = { connected: false }
            }
          } else {
            results[p.id] = { connected: false }
          }
        } catch {
          results[p.id] = { connected: false }
        }
      }
      setStatuses(results)
    }
    probe()
  }, [])

  async function handleConnect(provider) {
    setError('')
    if (provider.auth === 'redirect') {
      window.location.href = `${BACKEND_URL}/api/login`
      return
    }
    if (provider.auth === 'token') {
      setPasteTarget(provider)
      return
    }
    if (provider.auth === 'explore') {
      setProvider('alphavantage')
      navigate('/markets')
    }
  }

  async function handlePasteSubmit(e) {
    e.preventDefault()
    if (!pasteToken.trim()) return
    setLoading(true)
    setError('')
    try {
      const r = await apiFetch('/api/indmoney/exchange', {
        method: 'POST',
        body: JSON.stringify({ access_token: pasteToken.trim() }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Exchange failed')
      setStatuses((s) => ({ ...s, indmoney: { connected: true, public_access_token: d.public_access_token, generated_at: new Date().toISOString() } }))
      setProvider('indmoney')
      setPasteTarget(null)
      setPasteToken('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect(provider) {
    setLoading(true)
    try {
      const path = provider.id === 'indmoney' ? '/api/indmoney/logout' : '/api/logout'
      await apiFetch(path, { method: 'POST' })
      setStatuses((s) => ({ ...s, [provider.id]: { connected: false } }))
      if (provider.id === 'paytm') setToken(null)
      setProvider(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const brokerProviders = PROVIDER_LIST.filter((p) => p.auth !== 'explore' && p.auth !== 'csv')

  return (
    <div className="mx-auto max-w-xl space-y-8">
      {/* Broker connections */}
      <div>
        <h1 className="mb-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Broker Connections</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Connect your broker to pull live holdings and prices automatically.
        </p>
        <div className="space-y-4">
          {brokerProviders.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              status={statuses[p.id]}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        <span className="text-xs font-medium uppercase tracking-widest text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      </div>

      {/* CSV upload */}
      <div>
        <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">No broker account? Import CSV</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Download your tradebook from any broker app (Zerodha Console → Reports → Trade book, Paytm → Statements,
          Groww → Profit &amp; Loss, Upstox → Downloads) and upload it here. Your portfolio, P&amp;L, and analytics
          will be built from the file — live prices come from Yahoo Finance.
        </p>
        <CsvUploadCard onActivated={() => { reload(); navigate('/') }} />
      </div>

      {/* Paste token modal for INDstocks */}
      {pasteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#13161b] p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-slate-100">Connect {pasteTarget.name}</h2>
            <p className="mb-4 text-sm text-slate-400">
              Log in on INDstocks, copy your access token, and paste it below.
            </p>
            <form onSubmit={handlePasteSubmit} className="space-y-3">
              <textarea
                value={pasteToken}
                onChange={(e) => setPasteToken(e.target.value)}
                placeholder="Paste your INDstocks access token…"
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !pasteToken.trim()}
                  className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save token'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPasteTarget(null); setPasteToken(''); setError('') }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && !pasteTarget && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
