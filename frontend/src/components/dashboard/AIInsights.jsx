import { useEffect, useMemo, useState } from 'react'
import { usePortfolio } from '../../context/PortfolioContext'
import { buildInsightPayload } from '../../analytics/insightsPayload'
import { fetchInsight } from '../../services/insightsApi'
import { Card, SectionTitle, Skeleton } from '../common/ui'

// AI Portfolio Analyst card (PRD Module 7). Sends compact metrics to the backend, which
// uses the LLM (OpenRouter) or a heuristic fallback. Shows which produced the text.
export default function AIInsights() {
  const { holdings, journeys, transactions, loading: pLoading } = usePortfolio()
  const [scope, setScope] = useState('daily')
  const [state, setState] = useState({ loading: true, text: '', model: null, error: null })

  const payload = useMemo(
    () => buildInsightPayload({ holdings, journeys, transactions }),
    [holdings, journeys, transactions],
  )

  const load = async (refresh = false) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const d = await fetchInsight(scope, payload, { refresh })
      setState({ loading: false, text: d.text, model: d.model, error: null })
    } catch (e) {
      setState({ loading: false, text: '', model: null, error: e.message })
    }
  }

  useEffect(() => {
    if (pLoading || !holdings.length) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, pLoading, holdings.length])

  const isAI = state.model && state.model !== 'heuristic'

  return (
    <Card className="p-4">
      <SectionTitle
        title="🤖 AI Portfolio Analyst"
        subtitle="Generated from your live portfolio + lifetime ledger"
        right={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
              {['daily', 'weekly'].map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                    scope === s ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={() => load(true)}
              disabled={state.loading}
              title="Regenerate"
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs hover:border-slate-400 disabled:opacity-50 dark:border-white/10 dark:hover:border-white/30"
            >
              ↻
            </button>
          </div>
        }
      />

      {state.model && (
        <span
          className={`mb-3 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
            isAI ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-400/15 text-slate-500'
          }`}
        >
          {isAI ? `AI · ${state.model}` : 'Heuristic (set OPENROUTER_API_KEY for AI)'}
        </span>
      )}

      {state.loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : state.error ? (
        <p className="text-sm text-slate-400">Couldn't generate insights: {state.error}</p>
      ) : (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {state.text}
        </div>
      )}
    </Card>
  )
}
