// AES-256-GCM encryption for broker tokens stored in broker_accounts.
// Key comes from TOKEN_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
// Encrypted format: "enc:v1:<iv_b64>:<tag_b64>:<ct_b64>"
// If no key is set: plaintext passthrough with a dev-mode warning (never use in prod).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO   = 'aes-256-gcm'
const PREFIX = 'enc:v1:'

let _warnedOnce = false

function getKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY
  if (!hex) {
    if (!_warnedOnce) {
      console.warn('[stocker] WARNING: TOKEN_ENCRYPTION_KEY not set — broker tokens stored in PLAINTEXT. Set a 64-hex-char key in .env for production.')
      _warnedOnce = true
    }
    return null
  }
  if (hex.length !== 64) throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
  return Buffer.from(hex, 'hex')
}

// Encrypt a JSON-serialisable value. Returns the enc:v1:… string.
export function encryptJson(value) {
  const plaintext = JSON.stringify(value)
  const key = getKey()
  if (!key) return plaintext   // dev-mode plaintext

  const iv     = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()

  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

// Decrypt and JSON.parse. Handles both encrypted and legacy plaintext values.
export function decryptJson(stored) {
  if (!stored) return null

  if (!stored.startsWith(PREFIX)) {
    // Legacy plaintext — just parse it. (Will be re-encrypted on next save.)
    try { return JSON.parse(stored) } catch { return null }
  }

  const key = getKey()
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY is required to decrypt existing broker tokens')

  const parts = stored.slice(PREFIX.length).split(':')
  if (parts.length !== 3) throw new Error('Malformed encrypted token — expected enc:v1:<iv>:<tag>:<ct>')

  const [ivB64, tagB64, ctB64] = parts
  const iv      = Buffer.from(ivB64,  'base64')
  const tag     = Buffer.from(tagB64, 'base64')
  const ct      = Buffer.from(ctB64,  'base64')

  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  return JSON.parse(plain)
}

// True if the stored string is already encrypted with our scheme.
export const isEncrypted = (s) => typeof s === 'string' && s.startsWith(PREFIX)

// Generate a fresh key suitable for TOKEN_ENCRYPTION_KEY (print once at setup).
export function generateKey() {
  return randomBytes(32).toString('hex')
}
