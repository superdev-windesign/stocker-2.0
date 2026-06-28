import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod'
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12)
export const COOKIE_NAME = 'stocker_sid'

const isProd = process.env.NODE_ENV === 'production'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
}

export const hashPassword = (pw) => bcrypt.hash(pw, BCRYPT_ROUNDS)
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash)

export function signToken(userId) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch {
    return null
  }
}

export function setCookie(res, token) {
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS)
}

export function clearCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax' })
}

export function extractToken(req) {
  return req.cookies?.[COOKIE_NAME] || null
}
