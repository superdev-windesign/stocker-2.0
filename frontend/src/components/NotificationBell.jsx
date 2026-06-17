import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlerts } from '../context/AlertsContext'
import { fmtDate, fmtTime } from '../analytics/format'

// Header bell + dropdown showing the in-app notification inbox (polled in AlertsContext).
export default function NotificationBell() {
  const { notifications, unread, readNotification, readAll } = useAlerts()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm transition hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-down px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#12161c]">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-white/10">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</span>
              {unread > 0 && (
                <button onClick={readAll} className="text-xs text-indigo-500 hover:underline">Mark all read</button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-400">No notifications yet.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      readNotification(n.id)
                      if (n.symbol) navigate('/alerts')
                      setOpen(false)
                    }}
                    className={`block w-full border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 ${
                      n.read ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{n.title}</div>
                        {n.body && <div className="truncate text-xs text-slate-500 dark:text-slate-400">{n.body}</div>}
                        <div className="text-[11px] text-slate-400">{fmtDate(n.createdAt)} {fmtTime(n.createdAt)}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
