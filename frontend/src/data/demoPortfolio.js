// Dummy portfolio for "Demo mode" — lets the dashboard be showcased (or
// screenshotted) without a real Paytm login. Shaped exactly like Paytm's
// holdings payload so it flows through the same normalizeHoldings() pipeline
// as live data. Values are illustrative, not real positions.

const h = (nse_symbol, nse_security_id, display_name, quantity, cost_price, last_traded_price, pc, sector, mcap_type, isin_code) => ({
  nse_symbol,
  nse_security_id,
  display_name,
  quantity: String(quantity),
  cost_price: String(cost_price),
  last_traded_price: String(last_traded_price),
  pc,
  sector,
  mcap_type,
  isin_code,
  exchange: 'ALL',
  security_source_type: 'HLD',
})

export const DEMO_HOLDINGS = {
  holdings: {
    data: {
      results: [
        h('RELIANCE', '2885', 'Reliance Industries', 50, 2400, 2950.5, 2930, 'Energy', 'Large Cap', 'INE002A01018'),
        h('TCS', '11536', 'Tata Consultancy Services', 30, 3600, 3420.8, 3455, 'IT', 'Large Cap', 'INE467B01029'),
        h('HDFCBANK', '1333', 'HDFC Bank', 60, 1450, 1682.3, 1668, 'Banking', 'Large Cap', 'INE040A01034'),
        h('INFY', '1594', 'Infosys', 80, 1380, 1521.6, 1509, 'IT', 'Large Cap', 'INE009A01021'),
        h('ICICIBANK', '4963', 'ICICI Bank', 70, 950, 1243.0, 1236, 'Banking', 'Large Cap', 'INE090A01021'),
        h('ITC', '1660', 'ITC', 200, 410, 447.9, 445, 'FMCG', 'Large Cap', 'INE154A01025'),
        h('TATAMOTORS', '3456', 'Tata Motors', 90, 620, 968.4, 958, 'Auto', 'Large Cap', 'INE155A01022'),
        h('SBIN', '3045', 'State Bank of India', 120, 590, 818.7, 812, 'Banking', 'Large Cap', 'INE062A01020'),
        h('BHARTIARTL', '10604', 'Bharti Airtel', 65, 880, 1558.2, 1547, 'Telecom', 'Large Cap', 'INE397D01024'),
        h('LT', '11483', 'Larsen & Toubro', 25, 3200, 3648.5, 3625, 'Infrastructure', 'Large Cap', 'INE018A01030'),
        h('SUNPHARMA', '3351', 'Sun Pharmaceutical', 75, 1150, 1042.5, 1051, 'Pharma', 'Large Cap', 'INE044A01036'),
        h('TATASTEEL', '3499', 'Tata Steel', 300, 138, 162.4, 160, 'Metals', 'Large Cap', 'INE081A01020'),
      ],
    },
    meta: { displayMessage: null },
  },
  value: null,
}

export const DEMO_ORDERS = []

// Demo lifetime ledger — illustrative buy/sell history so the Stock Journey,
// timeline, trade analytics, and re-entry features render without a real login.
// Includes held stocks (multiple buys / partial sells) and a FULLY EXITED stock
// (WIPRO) to showcase the re-entry watchlist + last-sold reminder.
const t = (symbol, name, securityId, type, date, quantity, price, notes = null) => ({
  symbol, name, securityId, exchange: 'NSE', type, date, quantity, price, notes, source: 'manual',
})

export const DEMO_TRANSACTIONS = [
  // RELIANCE — averaged up over time, still holding 50.
  t('RELIANCE', 'Reliance Industries', '2885', 'BUY', '2022-03-14', 20, 2280, 'Initial position after correction'),
  t('RELIANCE', 'Reliance Industries', '2885', 'BUY', '2022-09-02', 20, 2410, 'Added on Jio momentum'),
  t('RELIANCE', 'Reliance Industries', '2885', 'BUY', '2023-06-19', 10, 2560),

  // TCS — bought, averaged, took partial profit, re-bought. Currently 30.
  t('TCS', 'Tata Consultancy Services', '11536', 'BUY', '2021-11-05', 15, 3350, 'Long-term conviction stock'),
  t('TCS', 'Tata Consultancy Services', '11536', 'BUY', '2022-06-20', 15, 3180, 'Averaged on IT selloff'),
  t('TCS', 'Tata Consultancy Services', '11536', 'SELL', '2023-01-12', 10, 3520, 'Booked partial profit'),
  t('TCS', 'Tata Consultancy Services', '11536', 'BUY', '2023-10-30', 10, 3410),

  // HDFCBANK — accumulated through the merger overhang. Holding 60.
  t('HDFCBANK', 'HDFC Bank', '1333', 'BUY', '2022-02-10', 30, 1380, 'Bought after quarterly results'),
  t('HDFCBANK', 'HDFC Bank', '1333', 'BUY', '2023-07-25', 30, 1520, 'Added post-merger dip'),

  // INFY — holding 80.
  t('INFY', 'Infosys', '1594', 'BUY', '2022-05-18', 50, 1320),
  t('INFY', 'Infosys', '1594', 'BUY', '2023-03-09', 30, 1480, 'Averaged on guidance cut'),

  // WIPRO — FULLY EXITED. Sold everything; now a re-entry candidate.
  t('WIPRO', 'Wipro', '3787', 'BUY', '2021-12-01', 100, 640, 'IT sector bet'),
  t('WIPRO', 'Wipro', '3787', 'SELL', '2022-04-22', 50, 580, 'Cut half — momentum fading'),
  t('WIPRO', 'Wipro', '3787', 'SELL', '2022-08-15', 50, 420, 'Sold remaining — valuation was high, exited fully'),
]

// Current prices for symbols that aren't in holdings (i.e. fully exited), so the
// re-entry watchlist / last-sold reminder can compare against live price in demo.
export const DEMO_EXITED_PRICES = {
  WIPRO: 248.5, // well below the ₹420 last exit → shows as a re-entry opportunity
}
