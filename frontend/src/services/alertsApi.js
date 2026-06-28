// Fetch wrappers for the alert engine + in-app notification inbox.
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

// Alerts
export const fetchAlerts = () => req('/api/alerts')
export const createAlert = (a) => req('/api/alerts', { method: 'POST', body: a })
export const pauseAlert = (id) => req(`/api/alerts/${id}/pause`, { method: 'POST' })
export const resumeAlert = (id) => req(`/api/alerts/${id}/resume`, { method: 'POST' })
export const deleteAlertApi = (id) => req(`/api/alerts/${id}`, { method: 'DELETE' })

// Notifications (in-app inbox)
export const fetchNotifications = () => req('/api/notifications')
export const markNotificationRead = (id) => req('/api/notifications/read', { method: 'POST', body: { id } })
export const markAllNotificationsRead = () => req('/api/notifications/read-all', { method: 'POST' })
