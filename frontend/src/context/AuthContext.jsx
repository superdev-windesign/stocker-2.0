import { createContext, useContext, useEffect, useState } from 'react'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

// All fetch calls go through this helper so credentials (httpOnly cookie) are always sent.
async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  return res
}

const AuthContext = createContext(null)

/**
 * Two-layer auth:
 *  1. Stocker account (email/password → JWT httpOnly cookie) — controls access to the app.
 *  2. Broker connection (Paytm / INDmoney OAuth) — controls live data. Stored per-user
 *     in broker_accounts after the Stocker session is established.
 */
export function AuthProvider({ children }) {
  // Stocker user session
  const [user, setUser] = useState(null)         // { id, email, name }
  const [checking, setChecking] = useState(true)

  // Broker connection (Paytm public_access_token for WebSocket use)
  const [token, setToken] = useState(null)
  const [authError, setAuthError] = useState(null)

  // Selected broker/provider (paytm | indmoney). Persisted in localStorage.
  const [provider, setProviderState] = useState(() => {
    try { return localStorage.getItem('stocker_provider') || null } catch { return null }
  })
  const setProvider = (id) => {
    setProviderState(id)
    try { id ? localStorage.setItem('stocker_provider', id) : localStorage.removeItem('stocker_provider') } catch { /* ignore */ }
  }

  // Demo mode: show dummy portfolio without a real account.
  const [demo, setDemoState] = useState(() => {
    try { return localStorage.getItem('stocker_demo') === '1' } catch { return false }
  })
  const setDemo = (v) => {
    setDemoState(v)
    try { v ? localStorage.setItem('stocker_demo', '1') : localStorage.removeItem('stocker_demo') } catch { /* ignore */ }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cleanUrl = () => window.history.replaceState({}, '', window.location.pathname)

    if (params.get('error')) {
      setAuthError(decodeURIComponent(params.get('error')))
      cleanUrl()
    }

    // Paytm Return-URL callback: exchange request_token once Stocker session exists.
    const requestToken = params.get('requestToken') || params.get('request_token')

    const init = async () => {
      // 1. Check Stocker session.
      const meRes = await apiFetch('/auth/me')
      if (meRes.ok) {
        const { user: u } = await meRes.json()
        setUser(u)

        // 2. If a Paytm return token is in the URL, exchange it now.
        if (requestToken) {
          try {
            const r = await apiFetch('/api/exchange', {
              method: 'POST',
              body: JSON.stringify({ request_token: requestToken }),
            })
            const d = await r.json().catch(() => ({}))
            if (r.ok && d.public_access_token) setToken(d.public_access_token)
            else setAuthError(d.error || 'Broker token exchange failed')
          } catch (e) {
            setAuthError(e.message)
          } finally {
            cleanUrl()
          }
          return
        }

        // 3. Probe for existing broker token (keeps session alive across refresh).
        try {
          const tokenPath = provider === 'indmoney' ? '/api/indmoney/token' : '/api/token'
          const r = await apiFetch(tokenPath)
          const d = r.ok ? await r.json() : null
          if (d?.public_access_token) setToken(d.public_access_token)
        } catch { /* no broker connected yet */ }

        if (params.get('connected')) cleanUrl()
      } else {
        // Not logged in — handled by App.jsx redirect to /login.
        if (requestToken) cleanUrl()
      }
    }

    init().finally(() => setChecking(false))
  }, [])

  // ── Stocker account auth ────────────────────────────────────────────────────
  async function login(email, password) {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    setUser(data.user)
    return data.user
  }

  async function register(email, password, name) {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Registration failed')
    setUser(data.user)
    return data.user
  }

  async function logout() {
    // Sign out of Stocker (clears JWT cookie).
    await apiFetch('/auth/logout', { method: 'POST' })
    setUser(null)
    setToken(null)
    setDemo(false)
    setProvider(null)
    setAuthError(null)
  }

  // Disconnect broker (keeps Stocker session, only removes broker token).
  async function disconnectBroker() {
    await apiFetch('/api/logout', { method: 'POST' })
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        // Stocker session
        user, setUser, checking,
        login, register, logout,
        // Broker connection
        token, setToken,
        disconnectBroker,
        authError, setAuthError,
        // Provider selection + demo mode
        provider, setProvider,
        demo, setDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
