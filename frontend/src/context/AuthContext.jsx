import { createContext, useContext, useEffect, useState } from 'react'

// The frontend talks to the standalone Express backend. Dev defaults to the local
// backend on :5174; set VITE_BACKEND_URL to point at a deployed backend in production.
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

const AuthContext = createContext(null)

/**
 * Tracks the Paytm session. "Logged in" == the token-helper backend has a cached
 * public_access_token (returned by GET /api/token). Portfolio /api/* calls use the
 * backend's server-side access_token, so the frontend only needs this token for the
 * live websocket and as a login signal.
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [checking, setChecking] = useState(true)
  // Selected broker/provider (paytm | indmoney). Persisted so a refresh keeps the
  // chosen platform. Drives which auth flow + markets the app uses.
  const [provider, setProviderState] = useState(() => {
    try {
      return localStorage.getItem('stocker_provider') || null
    } catch {
      return null
    }
  })

  const setProvider = (id) => {
    setProviderState(id)
    try {
      id ? localStorage.setItem('stocker_provider', id) : localStorage.removeItem('stocker_provider')
    } catch {
      /* ignore */
    }
  }
  // Demo mode: show dummy portfolio data without a real Paytm login. Persisted so
  // a refresh stays in demo. Independent of `token` — can be toggled either way.
  const [demo, setDemoState] = useState(() => {
    try {
      return localStorage.getItem('stocker_demo') === '1'
    } catch {
      return false
    }
  })

  const setDemo = (v) => {
    setDemoState(v)
    try {
      v ? localStorage.setItem('stocker_demo', '1') : localStorage.removeItem('stocker_demo')
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cleanUrl = () => window.history.replaceState({}, '', window.location.pathname)

    if (params.get('error')) {
      setAuthError(decodeURIComponent(params.get('error')))
      cleanUrl()
    }

    // Paytm's Return URL redirects to the app root with ?requestToken=... — hand it to
    // the backend, which exchanges it for the token set and stores it in Turso.
    const requestToken = params.get('requestToken') || params.get('request_token')

    const init = async () => {
      if (requestToken) {
        try {
          const r = await fetch(`${BACKEND_URL}/api/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_token: requestToken }),
          })
          const d = await r.json().catch(() => ({}))
          if (r.ok && d.public_access_token) setToken(d.public_access_token)
          else setAuthError(d.error || 'Token exchange failed')
        } catch (e) {
          setAuthError(e.message)
        } finally {
          cleanUrl()
        }
        return
      }

      // No request token: probe the backend so a page refresh stays logged in. Use the
      // selected provider's token endpoint (Paytm by default).
      try {
        const tokenPath = provider === 'indmoney' ? '/api/indmoney/token' : '/api/token'
        const r = await fetch(`${BACKEND_URL}${tokenPath}`)
        const d = r.ok ? await r.json() : null
        if (d?.public_access_token) setToken(d.public_access_token)
      } catch {
        /* not logged in yet */
      }
      if (params.get('connected')) cleanUrl()
    }

    init().finally(() => setChecking(false))
  }, [])

  const logout = () => {
    setToken(null)
    setDemo(false)
    setProvider(null)
    fetch(`${BACKEND_URL}/api/logout`, { method: 'POST' }).catch(() => {})
  }

  return (
    <AuthContext.Provider
      value={{ token, setToken, authError, setAuthError, checking, logout, demo, setDemo, provider, setProvider }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
