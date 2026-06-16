const STYLES = {
  idle: { dot: 'bg-gray-500', text: 'text-gray-400', label: 'Not connected' },
  connecting: { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300', label: 'Connecting…' },
  connected: { dot: 'bg-up', text: 'text-up', label: 'Live' },
  error: { dot: 'bg-down', text: 'text-down', label: 'Error' },
  closed: { dot: 'bg-gray-500', text: 'text-gray-400', label: 'Disconnected' },
}

export default function ConnectionBadge({ status, error }) {
  const s = STYLES[status] || STYLES.idle
  return (
    <div className="flex items-center gap-2" title={error || ''}>
      <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
      <span className={`text-sm font-medium ${s.text}`}>{s.label}</span>
    </div>
  )
}
