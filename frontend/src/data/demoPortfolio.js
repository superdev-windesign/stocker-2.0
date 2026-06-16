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
