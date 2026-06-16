import { Card, SectionTitle, EmptyState } from '../common/ui'
import DataTable from '../common/DataTable'
import { inr, fmtTime } from '../../analytics/format'

const num = (...v) => {
  for (const x of v) if (x != null && x !== '' && !Number.isNaN(Number(x))) return Number(x)
  return null
}
const pick = (...v) => v.find((x) => x != null && x !== '') ?? '—'

// Normalize a Paytm order/trade record (field names vary).
function normalizeTrade(o, i) {
  const qty = num(o.quantity, o.qty, o.traded_qty, o.filled_qty) ?? 0
  const price = num(o.avg_traded_price, o.price, o.traded_price, o.avg_price) ?? 0
  const charges = num(o.charges, o.brokerage) ?? 0
  const type = String(pick(o.txn_type, o.transaction_type, o.type)).toUpperCase()
  const isBuy = type.startsWith('B')
  const value = qty * price
  return {
    id: pick(o.order_no, o.order_id, o.id, i),
    time: o.order_date_time || o.create_time || o.exchange_time || null,
    symbol: pick(o.security_symbol, o.symbol, o.tradingsymbol, o.display_name),
    type: isBuy ? 'BUY' : 'SELL',
    isBuy,
    quantity: qty,
    price,
    value,
    charges,
    net: isBuy ? value + charges : value - charges,
  }
}

export default function TradeHistory({ orders }) {
  const rows = (orders || []).map(normalizeTrade)

  const columns = [
    { key: 'time', label: 'Time', render: (r) => fmtTime(r.time) },
    { key: 'symbol', label: 'Symbol', render: (r) => <span className="font-medium">{r.symbol}</span> },
    { key: 'type', label: 'Type', render: (r) => (
      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${r.isBuy ? 'bg-up/10 text-up' : 'bg-down/10 text-down'}`}>
        {r.type}
      </span>
    ) },
    { key: 'quantity', label: 'Qty', align: 'right' },
    { key: 'price', label: 'Price', align: 'right', render: (r) => inr(r.price) },
    { key: 'value', label: 'Value', align: 'right', render: (r) => inr(r.value) },
    { key: 'charges', label: 'Charges', align: 'right', render: (r) => inr(r.charges) },
    { key: 'net', label: 'Net', align: 'right', render: (r) => inr(r.net) },
  ]

  return (
    <Card className="p-4">
      <SectionTitle
        title="Trade History"
        subtitle="Today's orders from Paytm. Full lifetime history needs the tradebook export."
      />
      {rows.length ? (
        <DataTable columns={columns} rows={rows} csvName="stocker-trades-today.csv" searchKeys={['symbol', 'type']} pageSize={10} />
      ) : (
        <EmptyState
          icon="🧾"
          title="No trades today"
          message="The Paytm Open API only returns the current trading day. Multi-year buy/sell history requires importing your Paytm Tradebook (coming soon)."
          action={
            <button disabled className="mt-3 cursor-not-allowed rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-400 dark:border-white/10">
              Import tradebook (coming soon)
            </button>
          }
        />
      )}
    </Card>
  )
}
