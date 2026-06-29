import { useEffect, useState } from 'react'
import { marketNews } from '../../services/marketApi'
import { Card, Skeleton } from '../common/ui'

const SENTIMENT_STYLE = {
  'Bullish':        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Somewhat-Bullish': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-500',
  'Bearish':        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Somewhat-Bearish': 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-500',
  'Neutral':        'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-500',
}

function sentimentStyle(label) {
  return SENTIMENT_STYLE[label] || SENTIMENT_STYLE['Neutral']
}

// Format "20241128T130000" → "Nov 28, 1:00 PM"
function fmtDate(s) {
  if (!s) return ''
  try {
    const d = new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:00Z`)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}

export default function NewsWidget({ tickers = '', topics = '' }) {
  const [state, setState] = useState({ loading: true, items: [], error: null })

  useEffect(() => {
    setState({ loading: true, items: [], error: null })
    marketNews(tickers, topics)
      .then((items) => setState({ loading: false, items: Array.isArray(items) ? items.slice(0, 20) : [], error: null }))
      .catch((e) => setState({ loading: false, items: [], error: e.message }))
  }, [tickers, topics])

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Market News</h3>
          <p className="text-xs text-slate-400">Sentiment-scored headlines · AlphaVantage</p>
        </div>
      </div>

      {state.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : state.error ? (
        <p className="py-6 text-center text-sm text-slate-400">{state.error}</p>
      ) : !state.items.length ? (
        <p className="py-6 text-center text-sm text-slate-400">No news available.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {state.items.map((a, i) => (
            <li key={i} className="py-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                  >
                    {a.title}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">{a.source}</span>
                    {a.publishedAt && (
                      <span className="text-xs text-slate-400">· {fmtDate(a.publishedAt)}</span>
                    )}
                    {a.tickers?.slice(0, 3).map((t) => (
                      <span key={t.ticker} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/5 dark:text-slate-500">
                        {t.ticker}
                      </span>
                    ))}
                  </div>
                </div>
                {a.overallSentiment && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sentimentStyle(a.overallSentiment)}`}>
                    {a.overallSentiment.replace('Somewhat-', '~').replace('Bullish', '▲').replace('Bearish', '▼').replace('Neutral', '—')}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
