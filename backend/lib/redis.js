// Singleton ioredis connection. Used by lib/cache.js and BullMQ workers.
// Falls back gracefully when REDIS_URL is not set (dev without Redis).
import { Redis } from 'ioredis'

let _shared = null

export function getRedis() {
  if (_shared) return _shared
  const url = process.env.REDIS_URL
  if (!url) {
    console.warn('[redis] REDIS_URL not set — falling back to in-memory cache')
    return null
  }
  _shared = new Redis(url, {
    maxRetriesPerRequest: null, // required by BullMQ blocking commands
    enableReadyCheck: false,
    lazyConnect: false,
  })
  _shared.on('connect', () => console.log('[redis] connected'))
  _shared.on('error', (err) => console.error('[redis] error:', err.message))
  return _shared
}

// BullMQ workers need a dedicated connection per worker (blocking XREAD).
// Call this once per Queue or Worker instance.
export function newRedisConnection() {
  const url = process.env.REDIS_URL
  if (!url) return null
  const conn = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
  conn.on('error', (err) => console.error('[redis:bullmq] error:', err.message))
  return conn
}
