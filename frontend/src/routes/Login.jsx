import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

async function apiFetch(path, body) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

// Password strength: 0–4
function pwStrength(p) {
  if (!p) return 0
  let s = 0
  if (p.length >= 8)          s++
  if (p.length >= 12)         s++
  if (/[A-Z]/.test(p))        s++
  if (/[0-9]/.test(p))        s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return Math.min(4, s)
}
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLOR = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500']
const STRENGTH_TEXT  = ['', 'text-red-500', 'text-orange-400', 'text-yellow-500', 'text-emerald-500']

function EyeIcon({ open }) {
  return open ? (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}

function PasswordInput({ value, onChange, placeholder = '••••••••', label, hint, showStrength }) {
  const [show, setShow] = useState(false)
  const strength = showStrength ? pwStrength(value) : 0

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          required
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder-slate-500"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          tabIndex={-1}
        >
          <EyeIcon open={show} />
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-1.5">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? STRENGTH_COLOR[strength] : 'bg-slate-200 dark:bg-white/10'}`}
              />
            ))}
          </div>
          {strength > 0 && (
            <p className={`mt-0.5 text-[11px] font-medium ${STRENGTH_TEXT[strength]}`}>
              {STRENGTH_LABEL[strength]} password
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()

  // Detect ?token=xxx in URL → jump straight to reset mode
  const [mode, setMode] = useState(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    return token ? 'reset' : 'login'
  })
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('token') || '')

  const [name, setName]               = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [error, setError]             = useState('')
  const [info, setInfo]               = useState('')   // success messages
  const [loading, setLoading]         = useState(false)
  const [resetUrl, setResetUrl]       = useState('')   // returned by forgot-password

  // Clear form state on mode switch
  useEffect(() => {
    setError(''); setInfo(''); setPassword(''); setConfirmPass('')
    if (mode !== 'reset') setResetUrl('')
  }, [mode])

  // Clean token from URL once we're in reset mode
  useEffect(() => {
    if (mode === 'reset' && resetToken) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [mode, resetToken])

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally { setLoading(false) }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPass) { setError('Passwords do not match'); return }
    if (pwStrength(password) < 2) { setError('Password is too weak — try adding uppercase, numbers, or symbols'); return }
    setLoading(true)
    try {
      await register(email, password, name)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally { setLoading(false) }
  }

  async function handleForgot(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const data = await apiFetch('/auth/forgot-password', { email })
      if (data.resetUrl) {
        setResetUrl(data.resetUrl)
      } else {
        setInfo('If that email is registered, a reset link has been generated.')
      }
    } catch (err) {
      setError(err.message || 'Request failed')
    } finally { setLoading(false) }
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPass) { setError('Passwords do not match'); return }
    if (pwStrength(password) < 2) { setError('Password is too weak'); return }
    setLoading(true)
    try {
      await apiFetch('/auth/reset-password', { token: resetToken, password })
      setInfo('Password updated! You can now sign in.')
      setMode('login')
    } catch (err) {
      setError(err.message || 'Reset failed')
    } finally { setLoading(false) }
  }

  const switchMode = (m) => { setMode(m); setEmail(''); setName('') }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#0b0e11]">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">📈</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Stocker</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Portfolio Intelligence Hub</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#13161b]">

          {/* ── RESET PASSWORD (from email link) ── */}
          {mode === 'reset' && (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Set new password</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Choose a strong password for your account.</p>
              </div>
              <form onSubmit={handleReset} className="space-y-4">
                <PasswordInput label="New password" value={password} onChange={(e) => setPassword(e.target.value)} showStrength />
                <PasswordInput label="Confirm new password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)}
                  hint={confirmPass && password !== confirmPass ? '✗ No match' : confirmPass && password === confirmPass ? '✓ Match' : ''}
                />
                {error && <ErrorBox msg={error} />}
                <button type="submit" disabled={loading}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                  {loading ? 'Saving…' : 'Update password'}
                </button>
              </form>
              <button onClick={() => switchMode('login')} className="mt-4 w-full text-center text-xs text-slate-400 hover:text-indigo-500">
                Back to sign in
              </button>
            </>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {mode === 'forgot' && (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Forgot password?</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Enter your email and we'll generate a reset link.</p>
              </div>

              {resetUrl ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Your reset link is ready. Copy it and open it in a browser:
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <span className="flex-1 break-all font-mono text-[11px] text-slate-700 dark:text-slate-300">{resetUrl}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(resetUrl); setInfo('Copied!') }}
                      className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      Copy
                    </button>
                  </div>
                  {info && <p className="text-xs text-emerald-600 dark:text-emerald-400">✓ {info}</p>}
                  <p className="text-[11px] text-slate-400">Link expires in 1 hour.</p>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email address</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                  </div>
                  {info && <p className="text-sm text-emerald-600 dark:text-emerald-400">✓ {info}</p>}
                  {error && <ErrorBox msg={error} />}
                  <button type="submit" disabled={loading}
                    className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                    {loading ? 'Generating link…' : 'Generate reset link'}
                  </button>
                </form>
              )}

              <button onClick={() => switchMode('login')} className="mt-4 w-full text-center text-xs text-slate-400 hover:text-indigo-500">
                Back to sign in
              </button>
            </>
          )}

          {/* ── SIGN IN / REGISTER ── */}
          {(mode === 'login' || mode === 'register') && (
            <>
              {/* Tab toggle */}
              <div className="mb-6 flex rounded-lg border border-slate-200 p-1 dark:border-white/10">
                {[['login', 'Sign in'], ['register', 'Create account']].map(([m, label]) => (
                  <button key={m} onClick={() => switchMode(m)}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
                      mode === m
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >{label}</button>
                ))}
              </div>

              {/* Success message (e.g. after password reset) */}
              {info && (
                <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                  ✓ {info}
                </div>
              )}

              <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">

                {/* Name — register only */}
                {mode === 'register' && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                      <span className="text-xs text-slate-400">optional</span>
                    </div>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                </div>

                {/* Password */}
                <PasswordInput
                  label="Password"
                  hint={mode === 'register' ? 'min 8 chars' : ''}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  showStrength={mode === 'register'}
                />

                {/* Confirm password — register only */}
                {mode === 'register' && (
                  <PasswordInput
                    label="Confirm password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    hint={
                      confirmPass && password !== confirmPass ? '✗ No match'
                      : confirmPass && password === confirmPass ? '✓ Match'
                      : ''
                    }
                  />
                )}

                {/* Forgot password link — login only */}
                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setMode('forgot')}
                      className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline dark:text-indigo-400">
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && <ErrorBox msg={error} />}

                <button type="submit" disabled={loading}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                  {loading
                    ? mode === 'register' ? 'Creating account…' : 'Signing in…'
                    : mode === 'register' ? 'Create account' : 'Sign in'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-600">
          Your portfolio data stays in your account. No trades are executed.
        </p>
      </div>
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
      {msg}
    </p>
  )
}
