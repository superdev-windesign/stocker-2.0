// Fetch wrappers around the backend transaction-ledger endpoints (/api/transactions).
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:5174' : '')

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

export const fetchTransactions = () => req('/api/transactions')
export const createTransaction = (tx) => req('/api/transactions', { method: 'POST', body: tx })
export const updateTransactionApi = (id, tx) => req(`/api/transactions/${id}`, { method: 'PUT', body: tx })
export const deleteTransactionApi = (id) => req(`/api/transactions/${id}`, { method: 'DELETE' })
export const importTransactionsApi = (transactions) =>
  req('/api/transactions/import', { method: 'POST', body: { transactions } })
export const clearTransactionsApi = () => req('/api/transactions', { method: 'DELETE' })
