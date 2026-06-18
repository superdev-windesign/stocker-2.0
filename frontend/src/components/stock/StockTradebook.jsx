import { useMemo } from 'react'
import { Card, SectionTitle, EmptyState, StatPill } from '../common/ui'
import DataTable from '../common/DataTable'
import { money, fmtDate } from '../../analytics/format'

/**
 * Per-share tradebook — every buy/sell for this stock from the lifetime ledger, in a
 * sortable/exportable table (date, type, qty, price, value, charges, notes).
 *
 * @param {Array} transactions  ledger txns for this symbol
 * @param {string} currency
 */
export default function StockTradebook({ transactions = [], currency = 'INR' }) {
  const rows = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .map((t) => ({ ...t, value: t.quantity * t.price })),
    [transactions],
  )

  if (!rows.length) {
    return (
      <Card className="p-4">
        <SectionTitle title="Tradebook" />
        <EmptyState icon="🧾" title="No trades for this stock yet" message="Import your tradebook or add trades in the Ledger." />
      </Card>
    )
  }

  const m = (v) => money(v, currency)
  const columns = [
    { key: 'date', label: 'Date', render: (r) => fmtDate(r.date) },
    {
      key: 'type',
      label: 'Type',
      render: (r) => <span className={`text-xs font-semibold ${r.type === 'BUY' ? 'text-up' : 'text-down'}`}>{r.type}</span>,
    },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'price', label: 'Price', align: 'right', render: (r) => m(r.price) },
    { key: 'value', label: 'Value', align: 'right', render: (r) => m(r.value) },
    { key: 'charges', label: 'Charges', align: 'right', render: (r) => (r.charges ? m(r.charges) : '—') },
    { key: 'notes', label: 'Notes', sortable: false, render: (r) => <span className="text-xs text-slate-500">{r.notes || '—'}</span> },
  ]

  const buys = rows.filter((r) => r.type === 'BUY')
  const sells = rows.filter((r) => r.type === 'SELL')

  return (
    <Card className="p-4">
      <SectionTitle
        title="Tradebook"
        subtitle={`${rows.length} trades · ${buys.length} buys, ${sells.length} sells`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        csvName="tradebook.csv"
        searchKeys={['type', 'date', 'notes']}
        initialSort={{ key: 'date', dir: 'desc' }}
        pageSize={15}
      />
    </Card>
  )
}
