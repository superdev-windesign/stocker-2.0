// The 5 Nifty 50 stocks to stream. `scripId` is the NSE security id Paytm expects.
export const STOCKS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', scripId: '2885' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', scripId: '11536' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', scripId: '1333' },
  { symbol: 'INFY', name: 'Infosys', scripId: '1594' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', scripId: '4963' },
]

// Subscription preferences sent to the Paytm websocket (LTP mode, NSE equities).
export const PREFERENCES = STOCKS.map((s) => ({
  actionType: 'ADD',
  modeType: 'LTP',
  scripType: 'EQUITY',
  exchangeType: 'NSE',
  scripId: s.scripId,
}))

// Fast lookup: security_id (number) -> stock meta. Ticks arrive keyed by security_id.
export const bySecurityId = STOCKS.reduce((acc, s) => {
  acc[Number(s.scripId)] = s
  return acc
}, {})
