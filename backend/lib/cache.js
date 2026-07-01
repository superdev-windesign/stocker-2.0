// TTL cache — Redis primary, in-memory Map fallback.
// Drop-in replacement for the local memo(key, ttlMs, fn) pattern used throughout the app.
// All callers get Redis persistence (survives restarts, shared across instances) automatically.
import { getRedis } from './redis.js'

const mem = new Map()

function memGet(key) {
  const hit = mem.get(key)
  return hit && hit.exp > Date.now() ? hit.val : null
}

function memSet(key, val, ttlMs) {
  mem.set(key, { val, exp: Date.now() + ttlMs })
}

export async function cacheGet(key) {
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get(key)
      if (raw != null) return JSON.parse(raw)
    } catch (err) {
      console.warn('[cache] redis get failed, falling back to mem:', err.message)
    }
  }
  return memGet(key)
}

export async function cacheSet(key, val, ttlMs) {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(val), 'PX', ttlMs)
      return
    } catch (err) {
      console.warn('[cache] redis set failed, falling back to mem:', err.message)
    }
  }
  memSet(key, val, ttlMs)
}

export async function cacheDel(key) {
  const redis = getRedis()
  if (redis) {
    try { await redis.del(key) } catch { /* ignore */ }
  }
  mem.delete(key)
}

// Same signature as the old synchronous memo(key, ttlMs, fn) but async.
export async function memo(key, ttlMs, fn) {
  const hit = await cacheGet(key)
  if (hit !== null) return hit
  const val = await fn()
  await cacheSet(key, val, ttlMs)
  return val
}
