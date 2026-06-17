import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAlerts } from '../context/AlertsContext'
import { Card, SectionTitle, EmptyState } from '../components/common/ui'
import { inr, fmtDate } from '../analytics/format'

const TYPES = [
  { v: 'PRICE_BELOW', label: 'Price drops below', unit: '₹', dir: false },
  { v: 'PRICE_ABOVE', label: 'Price goes above', unit: '₹', dir: false },
  { v: 'REENTRY_ZONE', label: 'Re-entry: price falls to/below', unit: '₹', dir: false },
  { v: 'PCT_CHANGE', label: 'Daily move ≥', unit: '%', dir: true },
  { v: 'NEAR_52W_LOW', label: 'Within X% of 52-week low', unit: '%', dir: false },
  { v: 'NEAR_52W_HIGH', label: 'Within X% of 52-week high', unit: '%', dir: false },
  { v: 'PORTFOLIO_PNL_PCT', label: 'Portfolio P&L crosses', unit: '%', dir: true, noSymbol: true },
]
const typeMeta = (v) => TYPES.find((t) => t.v === v) || TYPES[0]
const typeLabel = (v) => typeMeta(v).label

const input = 'rounded-md border border-slate-200 bg-transparent px-2 py-1.5 text-sm dark:border-white/10'

export default function Alerts() {
  const { alerts, addAlert, removeAlert, toggleAlert } = useAlerts()
  const [params] = useSearchParams()
  const [form, setForm] = useState(() => ({
    type: params.get('type') || 'PRICE_BELOW',
    symbol: params.get('symbol') || '',
    securityId: params.get('securityId') || '',
    threshold: params.get('threshold') || '',
    direction: 'ABOVE',
    channels: ['inapp'],
    repeat: false,
    note: '',
  }))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const meta = typeMeta(form.type)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggleChannel = (c) =>
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c],
    }))

  const submit = async (e) => {
    e.preventDefault()
    setMsg(null)
    if (!meta.noSymbol && !form.symbol.trim()) return setMsg({ type: 'error', text: 'Symbol is required.' })
    if (form.threshold === '' || Number.isNaN(Number(form.threshold)))
      return setMsg({ type: 'error', text: 'Enter a numeric threshold.' })
    setBusy(true)
    try {
      await addAlert({
        type: form.type,
        symbol: meta.noSymbol ? null : form.symbol.trim().toUpperCase(),
        securityId: form.securityId || null,
        threshold: Number(form.threshold),
        direction: meta.dir ? form.direction : null,
        channels: form.channels.length ? form.channels : ['inapp'],
        repeat: form.repeat,
        note: form.note || null,
      })
      setForm((f) => ({ ...f, threshold: '', note: '' }))
      setMsg({ type: 'ok', text: 'Alert created.' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const active = useMemo(() => alerts.filter((a) => a.status !== 'TRIGGERED'), [alerts])
  const triggered = useMemo(() => alerts.filter((a) => a.status === 'TRIGGERED'), [alerts])

  const Row = ({ a }) => (
    <li className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 dark:border-white/5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {a.symbol || 'Portfolio'} · <span className="text-slate-500">{typeLabel(a.type)}</span>{' '}
          {typeMeta(a.type).unit === '₹' ? `₹${inr(a.threshold)}` : `${a.threshold}${typeMeta(a.type).unit}`}
        </div>
        <div className="text-xs text-slate-400">
          {a.status}
          {a.lastValue != null && ` · last ${typeMeta(a.type).unit === '₹' ? `₹${inr(a.lastValue)}` : a.lastValue}`}
          {a.triggeredAt && ` · fired ${fmtDate(a.triggeredAt)}`}
          {a.channels?.length ? ` · ${a.channels.join(', ')}` : ''}
          {a.repeat ? ' · repeats' : ''}
          {a.note ? ` · “${a.note}”` : ''}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {a.status !== 'TRIGGERED' && (
          <button onClick={() => toggleAlert(a)} className="text-xs text-indigo-500 hover:underline">
            {a.status === 'PAUSED' ? 'Resume' : 'Pause'}
          </button>
        )}
        <button onClick={() => removeAlert(a.id)} className="text-xs text-down hover:underline">Delete</button>
      </div>
    </li>
  )

  return (
    <div className="space-y-6">
      <SectionTitle title="Alerts" subtitle="Get notified on price moves, 52-week extremes, and re-entry opportunities" />

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Create an alert</h3>
        <form onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <select className={`${input} col-span-2`} value={form.type} onChange={set('type')}>
            {TYPES.map((t) => (
              <option key={t.v} value={t.v}>{t.label}</option>
            ))}
          </select>
          {!meta.noSymbol && (
            <input className={input} placeholder="Symbol" value={form.symbol} onChange={set('symbol')} />
          )}
          <input
            className={input}
            type="number"
            step="any"
            placeholder={`Threshold (${meta.unit})`}
            value={form.threshold}
            onChange={set('threshold')}
          />
          {meta.dir && (
            <select className={input} value={form.direction} onChange={set('direction')}>
              <option value="ABOVE">Rises / Above</option>
              <option value="BELOW">Falls / Below</option>
            </select>
          )}
          <input className={input} placeholder="Note (optional)" value={form.note} onChange={set('note')} />
          <div className="col-span-2 flex flex-wrap items-center gap-4 sm:col-span-3 lg:col-span-6">
            <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.channels.includes('inapp')} onChange={() => toggleChannel('inapp')} /> In-app
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.channels.includes('email')} onChange={() => toggleChannel('email')} /> Email
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.repeat} onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.checked }))} /> Repeat (re-arm)
            </label>
            <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
              Create alert
            </button>
          </div>
        </form>
        {msg && <p className={`mt-3 text-sm ${msg.type === 'error' ? 'text-down' : 'text-up'}`}>{msg.text}</p>}
        <p className="mt-2 text-xs text-slate-400">
          Alerts are evaluated by the backend scheduler during market hours (email needs SMTP configured on the server).
        </p>
      </Card>

      <Card className="p-4">
        <SectionTitle title="Active alerts" subtitle={`${active.length} active / paused`} />
        {active.length === 0 ? (
          <EmptyState icon="🔔" title="No active alerts" message="Create one above, or add a re-entry alert from a stock you've exited." />
        ) : (
          <ul>{active.map((a) => <Row key={a.id} a={a} />)}</ul>
        )}
      </Card>

      {triggered.length > 0 && (
        <Card className="p-4">
          <SectionTitle title="Triggered" subtitle="One-shot alerts that have fired" />
          <ul>{triggered.map((a) => <Row key={a.id} a={a} />)}</ul>
        </Card>
      )}
    </div>
  )
}
