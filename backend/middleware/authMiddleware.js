import { verifyToken, extractToken } from '../lib/auth.js'

export function authMiddleware(req, res, next) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Session expired. Please log in again.' })
  req.userId = payload.sub
  next()
}
