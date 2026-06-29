import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { createUser, findByEmail, findById, storeResetToken, findByResetToken, updatePassword } from '../lib/users.js'
import { hashPassword, checkPassword, signToken, setCookie, clearCookie } from '../lib/auth.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { db } from '../lib/paytm.js'

const router = Router()

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
    if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' })
    const existing = await findByEmail(email)
    if (existing) return res.status(409).json({ error: 'Email already registered' })
    const passwordHash = await hashPassword(password)
    const user = await createUser({ email, name, passwordHash })
    const token = signToken(user.id)
    setCookie(res, token)
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    console.error('[auth] register error:', err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
    const user = await findByEmail(email)
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await checkPassword(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    const token = signToken(user.id)
    setCookie(res, token)
    res.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    console.error('[auth] login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST /auth/logout
router.post('/logout', (req, res) => {
  clearCookie(res)
  res.json({ ok: true })
})

// GET /auth/me — returns current user (or 401)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await findById(req.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /auth/claim-legacy — assign all NULL-user_id rows to the authenticated user.
// Call once after first registration to adopt legacy single-user data.
router.post('/claim-legacy', authMiddleware, async (req, res) => {
  try {
    const uid = req.userId
    const [tx, al, no, nav] = await Promise.all([
      db.execute({ sql: `UPDATE transactions   SET user_id=? WHERE user_id IS NULL`, args: [uid] }),
      db.execute({ sql: `UPDATE alerts         SET user_id=? WHERE user_id IS NULL`, args: [uid] }),
      db.execute({ sql: `UPDATE notifications  SET user_id=? WHERE user_id IS NULL`, args: [uid] }),
      db.execute({ sql: `UPDATE nav_snapshots  SET user_id=? WHERE user_id IS NULL`, args: [uid] }),
    ])
    res.json({
      ok: true,
      claimed: {
        transactions: tx.rowsAffected,
        alerts: al.rowsAffected,
        notifications: no.rowsAffected,
        navSnapshots: nav.rowsAffected,
      },
    })
  } catch (err) {
    console.error('[auth] claim-legacy error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /auth/forgot-password — generate a reset token and return the reset URL.
// No email service configured, so the URL is returned directly for the UI to display.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'email is required' })
    const user = await findByEmail(email)
    // Always return 200 to avoid leaking which emails are registered
    if (!user) return res.json({ ok: true })
    const token = randomUUID()
    await storeResetToken(user.id, token)
    const origin = req.headers.origin || `http://localhost:5173`
    res.json({ ok: true, resetUrl: `${origin}/login?token=${token}` })
  } catch (err) {
    console.error('[auth] forgot-password error:', err)
    res.status(500).json({ error: 'Request failed' })
  }
})

// POST /auth/reset-password — validate reset token and set new password.
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {}
    if (!token || !password) return res.status(400).json({ error: 'token and password are required' })
    if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' })
    const user = await findByResetToken(token)
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' })
    if (user.reset_expires && new Date(user.reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' })
    }
    const passwordHash = await hashPassword(password)
    await updatePassword(user.id, passwordHash)
    res.json({ ok: true })
  } catch (err) {
    console.error('[auth] reset-password error:', err)
    res.status(500).json({ error: 'Reset failed' })
  }
})

export default router
