import { useState } from 'react'

const ENV_TOKEN = import.meta.env.VITE_PAYTM_PUBLIC_ACCESS_TOKEN || ''
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

export default function TokenGate({ onConnect, onDemo, error }) {
  const [token, setToken] = useState(ENV_TOKEN)
  const [retrievedToken, setRetrievedToken] = useState(null)
  const [retrieveLoading, setRetrieveLoading] = useState(false)
  const [retrieveError, setRetrieveError] = useState(null)

  const submit = (e) => {
    e.preventDefault()
    const t = token.trim()
    if (t) onConnect(t)
  }

  const fetchStoredToken = async () => {
    setRetrieveLoading(true)
    setRetrieveError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/token/retrieve`)
      const data = await res.json()
      if (!res.ok) {
        setRetrieveError(data.error || 'Failed to retrieve token')
        setRetrievedToken(null)
      } else {
        setRetrievedToken(data)
        setToken(data.public_access_token)
      }
    } catch (err) {
      setRetrieveError(err.message)
    } finally {
      setRetrieveLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12161c] p-8 shadow-xl"
      >
        <h1 className="text-2xl font-bold tracking-tight">📈 Stocker</h1>
        <p className="mt-1 text-sm text-gray-400">Live Nifty 50 market data via Paytm Money</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Option 1: retrieve token from database (no new login needed). */}
        <button
          type="button"
          onClick={fetchStoredToken}
          disabled={retrieveLoading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
        >
          {retrieveLoading ? '⏳ Retrieving…' : '📦 Copy stored token from DB'}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Retrieves your previously-generated token from Turso (no re-login needed).
        </p>

        {retrieveError && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {retrieveError}
          </div>
        )}

        {retrievedToken && (
          <div className="mt-3 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs text-green-400">
            ✓ Token loaded (valid until {new Date(retrievedToken.expires_at).toLocaleString()})<br />
            Expires in ~{retrievedToken.expires_in_hours} hours
          </div>
        )}

        <div className="my-6 flex items-center gap-3 text-xs text-gray-600">
          <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
        </div>

        {/* Option 2: new login (generates fresh token). */}
        <a
          href={`${BACKEND_URL}/api/login`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition hover:bg-indigo-500"
        >
          🔑 Login with Paytm &amp; generate new token
        </a>
        <p className="mt-2 text-xs text-gray-500">
          Opens Paytm login. After sign-in, the token helper exchanges your request token and stores it in Turso.
        </p>

        <div className="my-6 flex items-center gap-3 text-xs text-gray-600">
          <span className="h-px flex-1 bg-white/10" /> or paste manually <span className="h-px flex-1 bg-white/10" />
        </div>

        <label className="block text-sm font-medium text-gray-300">
          Public access token
        </label>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={3}
          placeholder="Paste your Paytm Money public access token…"
          className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-[#0b0e11] p-3 font-mono text-sm text-gray-100 outline-none focus:border-indigo-500"
        />
        <p className="mt-2 text-xs text-gray-500">
          This is the daily token minted after the Paytm login flow (valid until midnight IST).
          You can also set <code className="text-gray-400">VITE_PAYTM_PUBLIC_ACCESS_TOKEN</code> in{' '}
          <code className="text-gray-400">.env</code> to pre-fill it.
        </p>

        <button
          type="submit"
          disabled={!token.trim()}
          className="mt-5 w-full rounded-lg border border-white/15 py-2.5 font-semibold text-gray-200 transition hover:border-white/35 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Connect with pasted token
        </button>

        {onDemo && (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-gray-600">
              <span className="h-px flex-1 bg-white/10" /> just looking? <span className="h-px flex-1 bg-white/10" />
            </div>
            <button
              type="button"
              onClick={onDemo}
              className="w-full rounded-lg border border-amber-400/40 bg-amber-400/10 py-2.5 font-semibold text-amber-400 transition hover:border-amber-400/70"
            >
              🎭 Explore with demo data
            </button>
            <p className="mt-2 text-xs text-gray-500">
              Loads a sample portfolio so you can try the dashboard — no Paytm login required.
            </p>
          </>
        )}
      </form>
    </div>
  )
}
