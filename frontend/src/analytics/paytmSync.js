// Seed the transaction ledger from real Paytm data so the journey/dashboard features
// work on live holdings (Paytm's API exposes no lifetime trade history — only current
// holdings + today's orders). Full history still comes from CSV import.
//
// Strategy: for any current holding NOT yet represented in the ledger, create a single
// baseline BUY of the full quantity at the holding's average price. This makes current
// shares held + average buy price reconcile exactly with Paytm, without double-counting.

const today = () => new Date().toISOString().slice(0, 10)

/**
 * @param {Array} holdings              normalized holdings (from normalizeHoldings)
 * @param {Array} existingTransactions  current ledger
 * @returns {Array} new baseline BUY rows to insert (empty if nothing to sync)
 */
export function buildHoldingSeedRows(holdings = [], existingTransactions = []) {
  const known = new Set(existingTransactions.map((t) => String(t.symbol).toUpperCase()))
  return holdings
    .filter((h) => h.quantity > 0 && h.symbol && !known.has(String(h.symbol).toUpperCase()))
    .map((h) => ({
      symbol: String(h.symbol).toUpperCase(),
      name: h.name || null,
      securityId: h.securityId != null ? String(h.securityId) : null,
      exchange: h.exchange || 'NSE',
      type: 'BUY',
      date: today(),
      quantity: h.quantity,
      price: h.avgPrice,
      notes: 'Imported from Paytm holdings (baseline position)',
      source: 'paytm',
    }))
}
