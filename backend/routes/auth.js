import { Router } from 'express'
import { createUser, findByEmail, findById } from '../lib/users.js'
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

export default router
