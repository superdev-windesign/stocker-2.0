import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import {
  fetchAlerts,
  createAlert,
  pauseAlert,
  resumeAlert,
  deleteAlertApi,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/alertsApi'

const AlertsContext = createContext(null)

const POLL_MS = 45000 // poll the inbox roughly every 45s (MVP; real push is a later phase)

/**
 * Loads alerts + the in-app notification inbox and polls for new notifications so the
 * header bell stays current. Tolerant of a missing/unreachable backend (stays empty).
 */
export function AlertsProvider({ children }) {
  const [alerts, setAlerts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)

  const loadAlerts = useCallback(async () => {
    try {
      setAlerts(await fetchAlerts())
    } catch {
      /* backend not configured yet — leave empty */
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    try {
      const { notifications: list, unread: u } = await fetchNotifications()
      setNotifications(list)
      setUnread(u)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadAlerts()
    loadNotifications()
    const t = setInterval(loadNotifications, POLL_MS)
    return () => clearInterval(t)
  }, [loadAlerts, loadNotifications])

  const addAlert = useCallback(async (a) => {
    await createAlert(a)
    await loadAlerts()
  }, [loadAlerts])

  const removeAlert = useCallback(async (id) => {
    await deleteAlertApi(id)
    await loadAlerts()
  }, [loadAlerts])

  const toggleAlert = useCallback(async (a) => {
    a.status === 'PAUSED' ? await resumeAlert(a.id) : await pauseAlert(a.id)
    await loadAlerts()
  }, [loadAlerts])

  const readNotification = useCallback(async (id) => {
    await markNotificationRead(id).catch(() => {})
    await loadNotifications()
  }, [loadNotifications])

  const readAll = useCallback(async () => {
    await markAllNotificationsRead().catch(() => {})
    await loadNotifications()
  }, [loadNotifications])

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        notifications,
        unread,
        reloadAlerts: loadAlerts,
        addAlert,
        removeAlert,
        toggleAlert,
        readNotification,
        readAll,
      }}
    >
      {children}
    </AlertsContext.Provider>
  )
}

export const useAlerts = () => useContext(AlertsContext)
