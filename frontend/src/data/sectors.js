// Bundled static enrichment: sector / industry / market-cap category for common
// NSE stocks (Paytm's API doesn't expose these). Keyed by uppercase NSE symbol.
// Unknown symbols fall back to UNKNOWN below.

const M = {
  RELIANCE: { sector: 'Energy', industry: 'Oil & Gas / Refining', cap: 'Large' },
  TCS: { sector: 'IT', industry: 'IT Services', cap: 'Large' },
  INFY: { sector: 'IT', industry: 'IT Services', cap: 'Large' },
  WIPRO: { sector: 'IT', industry: 'IT Services', cap: 'Large' },
  HCLTECH: { sector: 'IT', industry: 'IT Services', cap: 'Large' },
  TECHM: { sector: 'IT', industry: 'IT Services', cap: 'Large' },
  LTIM: { sector: 'IT', industry: 'IT Services', cap: 'Large' },
  HDFCBANK: { sector: 'Banking', industry: 'Private Bank', cap: 'Large' },
  ICICIBANK: { sector: 'Banking', industry: 'Private Bank', cap: 'Large' },
  KOTAKBANK: { sector: 'Banking', industry: 'Private Bank', cap: 'Large' },
  AXISBANK: { sector: 'Banking', industry: 'Private Bank', cap: 'Large' },
  SBIN: { sector: 'Banking', industry: 'Public Bank', cap: 'Large' },
  INDUSINDBK: { sector: 'Banking', industry: 'Private Bank', cap: 'Large' },
  BANKBARODA: { sector: 'Banking', industry: 'Public Bank', cap: 'Mid' },
  PNB: { sector: 'Banking', industry: 'Public Bank', cap: 'Mid' },
  BAJFINANCE: { sector: 'Financials', industry: 'NBFC', cap: 'Large' },
  BAJAJFINSV: { sector: 'Financials', industry: 'Financial Services', cap: 'Large' },
  HDFCLIFE: { sector: 'Financials', industry: 'Insurance', cap: 'Large' },
  SBILIFE: { sector: 'Financials', industry: 'Insurance', cap: 'Large' },
  ICICIPRULI: { sector: 'Financials', industry: 'Insurance', cap: 'Large' },
  HDFCAMC: { sector: 'Financials', industry: 'Asset Management', cap: 'Mid' },
  ITC: { sector: 'FMCG', industry: 'Cigarettes / FMCG', cap: 'Large' },
  HINDUNILVR: { sector: 'FMCG', industry: 'Household & Personal', cap: 'Large' },
  NESTLEIND: { sector: 'FMCG', industry: 'Packaged Foods', cap: 'Large' },
  BRITANNIA: { sector: 'FMCG', industry: 'Packaged Foods', cap: 'Large' },
  DABUR: { sector: 'FMCG', industry: 'Personal Care', cap: 'Mid' },
  TATACONSUM: { sector: 'FMCG', industry: 'Packaged Foods', cap: 'Large' },
  MARUTI: { sector: 'Auto', industry: 'Passenger Vehicles', cap: 'Large' },
  TATAMOTORS: { sector: 'Auto', industry: 'Automobiles', cap: 'Large' },
  M_M: { sector: 'Auto', industry: 'Automobiles', cap: 'Large' },
  'M&M': { sector: 'Auto', industry: 'Automobiles', cap: 'Large' },
  BAJAJ_AUTO: { sector: 'Auto', industry: 'Two Wheelers', cap: 'Large' },
  'BAJAJ-AUTO': { sector: 'Auto', industry: 'Two Wheelers', cap: 'Large' },
  EICHERMOT: { sector: 'Auto', industry: 'Two Wheelers', cap: 'Large' },
  HEROMOTOCO: { sector: 'Auto', industry: 'Two Wheelers', cap: 'Large' },
  TVSMOTOR: { sector: 'Auto', industry: 'Two Wheelers', cap: 'Mid' },
  SUNPHARMA: { sector: 'Pharma', industry: 'Pharmaceuticals', cap: 'Large' },
  DRREDDY: { sector: 'Pharma', industry: 'Pharmaceuticals', cap: 'Large' },
  CIPLA: { sector: 'Pharma', industry: 'Pharmaceuticals', cap: 'Large' },
  DIVISLAB: { sector: 'Pharma', industry: 'Pharma APIs', cap: 'Large' },
  APOLLOHOSP: { sector: 'Healthcare', industry: 'Hospitals', cap: 'Large' },
  LT: { sector: 'Infrastructure', industry: 'Construction & Engineering', cap: 'Large' },
  ULTRACEMCO: { sector: 'Cement', industry: 'Cement', cap: 'Large' },
  GRASIM: { sector: 'Cement', industry: 'Cement / Diversified', cap: 'Large' },
  SHREECEM: { sector: 'Cement', industry: 'Cement', cap: 'Mid' },
  AMBUJACEM: { sector: 'Cement', industry: 'Cement', cap: 'Mid' },
  TATASTEEL: { sector: 'Metals', industry: 'Steel', cap: 'Large' },
  JSWSTEEL: { sector: 'Metals', industry: 'Steel', cap: 'Large' },
  HINDALCO: { sector: 'Metals', industry: 'Aluminium', cap: 'Large' },
  COALINDIA: { sector: 'Energy', industry: 'Mining', cap: 'Large' },
  ONGC: { sector: 'Energy', industry: 'Oil & Gas', cap: 'Large' },
  NTPC: { sector: 'Power', industry: 'Power Generation', cap: 'Large' },
  POWERGRID: { sector: 'Power', industry: 'Power Transmission', cap: 'Large' },
  ADANIENT: { sector: 'Conglomerate', industry: 'Diversified', cap: 'Large' },
  ADANIPORTS: { sector: 'Infrastructure', industry: 'Ports & Logistics', cap: 'Large' },
  BHARTIARTL: { sector: 'Telecom', industry: 'Telecom Services', cap: 'Large' },
  ASIANPAINT: { sector: 'Consumer', industry: 'Paints', cap: 'Large' },
  TITAN: { sector: 'Consumer', industry: 'Jewellery & Watches', cap: 'Large' },
  DMART: { sector: 'Retail', industry: 'Retail', cap: 'Large' },
  AVENUE: { sector: 'Retail', industry: 'Retail', cap: 'Large' },
  ZOMATO: { sector: 'Consumer Tech', industry: 'Food Delivery', cap: 'Large' },
  PAYTM: { sector: 'Fintech', industry: 'Digital Payments', cap: 'Mid' },
  NYKAA: { sector: 'Consumer Tech', industry: 'E-commerce', cap: 'Mid' },
  IRCTC: { sector: 'Travel', industry: 'Railways Services', cap: 'Mid' },
}

export const UNKNOWN = { sector: 'Other', industry: '—', cap: 'Unknown' }

export function enrich(symbol) {
  if (!symbol) return UNKNOWN
  const key = String(symbol).toUpperCase().trim()
  return M[key] || M[key.replace(/[-&]/g, '_')] || UNKNOWN
}

// Stable color per sector for charts/heatmaps.
const SECTOR_COLORS = {
  Banking: '#6366f1',
  Financials: '#8b5cf6',
  IT: '#06b6d4',
  FMCG: '#10b981',
  Auto: '#f59e0b',
  Pharma: '#ec4899',
  Healthcare: '#f43f5e',
  Energy: '#ef4444',
  Power: '#eab308',
  Metals: '#94a3b8',
  Cement: '#a8a29e',
  Infrastructure: '#0ea5e9',
  Telecom: '#14b8a6',
  Consumer: '#f97316',
  Retail: '#84cc16',
  'Consumer Tech': '#d946ef',
  Fintech: '#22d3ee',
  Conglomerate: '#fb923c',
  Travel: '#2dd4bf',
  Other: '#64748b',
}

export const sectorColor = (s) => SECTOR_COLORS[s] || '#64748b'
