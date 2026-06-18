import { useMemo, useRef, useState, useEffect } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { useAlerts } from '../context/AlertsContext'
import { buildAgentContext } from '../analytics/agentContext'
import { askAgent } from '../services/agentApi'
import { Card, SectionTitle } from '../components/common/ui'

const SUGGESTIONS = [
  'How much capital-gains tax will I owe this year?',
  'Am I over-concentrated in any sector?',
  'Which stocks are below my last exit price?',
  'Alert me if WIPRO drops below my last sell price',
]

const loadTargets = () => {
  try {
    return JSON.parse(localStorage.getItem('stocker_targets') || '{}')
  } catch {
    return {}
  }
}

export default function Copilot() {
  const { holdings, journeys, transactions } = usePortfolio()
  const { reloadAlerts } = useAlerts()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your portfolio Copilot. Ask me about your taxes, concentration, re-entry opportunities, or tell me to set an alert.' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  const context = useMemo(
    () => buildAgentContext({ holdings, journeys, transactions }, loadTargets()),
    [holdings, journeys, transactions],
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  const send = async (text) => {
    const msg = (text ?? input).trim()
    if (!msg || busy) return
    setInput('')
    const history = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
    setMessages((m) => [...m, { role: 'user', content: msg }])
    setBusy(true)
    try {
      const { reply, actions, model } = await askAgent(msg, context, history)
      setMessages((m) => [...m, { role: 'assistant', content: reply, actions, model }])
      if (actions?.some((a) => a.kind === 'alert_created')) reloadAlerts?.()
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — ${e.message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="🤖 Copilot" subtitle="An agent that reasons over your portfolio and can take actions (e.g. create alerts)" />

      <Card className="flex h-[60vh] flex-col p-0">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-100'
                }`}
              >
                {m.content}
                {m.actions?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {m.actions.map((a, j) => (
                      <div key={j} className="rounded-md bg-up/10 px-2 py-1 text-xs font-medium text-up">✓ {a.summary}</div>
                    ))}
                  </div>
                )}
                {m.model && m.model !== 'heuristic' && (
                  <div className="mt-1 text-[10px] text-slate-400">via {m.model}</div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-sm text-slate-400">Copilot is thinking…</div>}
          <div ref={endRef} />
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-indigo-400 dark:border-white/10 dark:text-slate-300"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="flex gap-2 border-t border-slate-200 p-3 dark:border-white/10"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your portfolio, or tell me to set an alert…"
            className="flex-1 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-white/10"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </Card>
      <p className="text-xs text-slate-400">
        The Copilot uses your computed portfolio data (no raw broker data leaves the backend) and can create alerts on
        request. Full agentic chat needs OPENROUTER_API_KEY on the backend; otherwise it replies in a basic fallback mode.
      </p>
    </div>
  )
}
