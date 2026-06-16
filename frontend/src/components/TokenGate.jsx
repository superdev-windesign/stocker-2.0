import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { PROVIDER_LIST, getProvider } from '../config/providers'

const ENV_TOKEN = import.meta.env.VITE_PAYTM_PUBLIC_ACCESS_TOKEN || ''
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

const Divider = ({ children }) => (
  <div className="my-6 flex items-center gap-3 text-xs text-gray-600">
    <span className="h-px flex-1 bg-white/10" /> {children} <span className="h-px flex-1 bg-white/10" />
  </div>
)

// Step 1 — pick your trading platform.
function ProviderChooser({ onPick, onDemo }) {
  return (
    <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12161c] p-8 shadow-xl">
      <h1 className="text-2xl font-bold tracking-tight">📈 Stocker</h1>
      <p className="mt-1 text-sm text-gray-400">Choose your trading platform to continue</p>

      <div className="mt-6 grid gap-3">
        {PROVIDER_LIST.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0b0e11] p-4 text-left transition hover:border-indigo-500/60 hover:bg-white/[0.03]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{p.flag}</span>
              <div>
                <div className="font-semibold text-gray-100">{p.name}</div>
                <div className="text-xs text-gray-400">{p.markets}</div>
              </div>
            </div>
            <div className="text-right">
              {p.available ? (
                <span className="text-sm text-indigo-400">Continue →</span>
              ) : (
                <span className="rounded-md bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                  Setup pending
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {onDemo && (
        <>
          <Divider>just looking?</Divider>
          <button
            type="button"
            onClick={onDemo}
            className="w-full rounded-lg border border-amber-400/40 bg-amber-400/10 py-2.5 font-semibold text-amber-400 transition hover:border-amber-400/70"
          >
            🎭 Explore with demo data
          </button>
          <p className="mt-2 text-xs text-gray-500">Loads a sample portfolio — no broker login required.</p>
        </>
      )}
    </div>
  )
}

// Step 2 — connect to the chosen provider.
function ConnectPanel({ provider, onConnect, onBack, error }) {
  const [token, setToken] = useState(provider.id === 'paytm' ? ENV_TOKEN : '')
  const [retrieved, setRetrieved] = useState(null)
  const [loading, setLoading] = useState(false)
  const [retrieveError, setRetrieveError] = useState(null)

  const submit = (e) => {
    e.preventDefault()
    const t = token.trim()
    if (t) onConnect(t)
  }

  const fetchStoredToken = async () => {
    setLoading(true)
    setRetrieveError(null)
    try {
      const res = await fetch(`${BACKEND_URL}${provider.tokenRetrievePath}`)
      const data = await res.json()
      if (!res.ok) {
        setRetrieveError(data.error || 'Failed to retrieve token')
        setRetrieved(null)
      } else {
        setRetrieved(data)
        setToken(data.public_access_token)
      }
    } catch (err) {
      setRetrieveError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12161c] p-8 shadow-xl">
      <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-300">
        ← Change platform
      </button>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">
        {provider.flag} {provider.name}
      </h1>
      <p className="mt-1 text-sm text-gray-400">{provider.markets}</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
      )}

      {!provider.available ? (
        <div className="mt-6 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
          {provider.name} connection is being set up. Once its API credentials are configured on the
          backend it will connect here automatically. For now you can paste a token below, or go back
          and choose Paytm Money.
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={fetchStoredToken}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
          >
            {loading ? '⏳ Retrieving…' : '📦 Copy stored token from DB'}
          </button>
          <p className="mt-2 text-xs text-gray-500">Retrieves a previously-generated token (no re-login needed).</p>

          {retrieveError && (
            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">{retrieveError}</div>
          )}
          {retrieved && (
            <div className="mt-3 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs text-green-400">
              ✓ Token loaded{retrieved.expires_at ? ` (valid until ${new Date(retrieved.expires_at).toLocaleString()})` : ''}
            </div>
          )}

          <Divider>or</Divider>

          <a
            href={`${BACKEND_URL}${provider.loginPath}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition hover:bg-indigo-500"
          >
            🔑 Login with {provider.name}
          </a>
          <p className="mt-2 text-xs text-gray-500">
            Opens {provider.name} login; the backend exchanges your request token and stores the session.
          </p>
        </>
      )}

      <Divider>or paste manually</Divider>
      <textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        rows={3}
        placeholder={`Paste your ${provider.name} access token…`}
        className="w-full resize-none rounded-lg border border-white/10 bg-[#0b0e11] p-3 font-mono text-sm text-gray-100 outline-none focus:border-indigo-500"
      />
      <button
        type="submit"
        disabled={!token.trim()}
        className="mt-4 w-full rounded-lg border border-white/15 py-2.5 font-semibold text-gray-200 transition hover:border-white/35 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Connect with pasted token
      </button>
    </form>
  )
}

export default function TokenGate({ onConnect, onDemo, error }) {
  const { provider, setProvider } = useAuth()
  const selected = provider ? getProvider(provider) : null

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      {selected ? (
        <ConnectPanel provider={selected} onConnect={onConnect} onBack={() => setProvider(null)} error={error} />
      ) : (
        <ProviderChooser onPick={setProvider} onDemo={onDemo} />
      )}
    </div>
  )
}
