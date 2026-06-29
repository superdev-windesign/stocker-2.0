import { useEffect, useMemo, useRef, useState } from 'react'
import { usePortfolio } from '../context/PortfolioContext'
import { useAlerts } from '../context/AlertsContext'
import { buildAgentContext } from '../analytics/agentContext'
import { askAgent } from '../services/agentApi'

const SUGGESTIONS = [
  'Calculate total portfolio P&L',
  'Am I over-concentrated in any sector?',
  'Which stocks are below my last exit price?',
  'Alert me if WIPRO drops below my last sell price',
]

const loadTargets = () => {
  try { return JSON.parse(localStorage.getItem('stocker_targets') || '{}') } catch { return {} }
}

function SparkleIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  )
}

function BotIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="8" width="18" height="12" rx="3" />
      <path d="M9 8V6a3 3 0 016 0v2" />
      <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9 17.5h6" strokeLinecap="round" />
    </svg>
  )
}

function MessageBubble({ m }) {
  const isUser = m.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
      {!isUser && (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
          <SparkleIcon className="h-3 w-3" />
        </div>
      )}
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-tr-sm bg-indigo-600 text-white'
            : 'rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-white/8 dark:text-slate-100'
        }`}
      >
        {m.content}
        {m.actions?.length > 0 && (
          <div className="mt-2 space-y-1">
            {m.actions.map((a, j) => (
              <div key={j} className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ✓ {a.summary}
              </div>
            ))}
          </div>
        )}
        {m.model && m.model !== 'heuristic' && (
          <div className="mt-1 text-[10px] text-slate-400">via {m.model}</div>
        )}
      </div>
    </div>
  )
}

export default function CopilotDrawer() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your portfolio Copilot. Ask me about your taxes, concentration, re-entry opportunities, or tell me to set an alert." },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const { holdings, journeys, transactions } = usePortfolio()
  const { reloadAlerts } = useAlerts()
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const drawerRef = useRef(null)

  const context = useMemo(
    () => buildAgentContext({ holdings, journeys, transactions }, loadTargets()),
    [holdings, journeys, transactions],
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  // Swipe detection — open with right-edge swipe left, close with swipe right
  useEffect(() => {
    const onTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }
    const onTouchEnd = (e) => {
      if (touchStartX.current === null) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
      if (dy > 80) { touchStartX.current = null; return } // vertical scroll
      if (!open && touchStartX.current > window.innerWidth * 0.72 && dx < -48) {
        setOpen(true)
      } else if (open && dx > 60) {
        setOpen(false)
      }
      touchStartX.current = null
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-[#0f1117] sm:max-w-[400px] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-white/10">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <SparkleIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Portfolio Copilot</p>
            <p className="text-[11px] text-slate-400">AI agent · reasons over your portfolio</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => <MessageBubble key={i} m={m} />)}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:300ms]" />
              </div>
              Copilot is thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="shrink-0 px-4 pb-2">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Try asking</p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); send() }}
          className="shrink-0 border-t border-slate-200 p-3 dark:border-white/10"
        >
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-indigo-400 dark:border-white/10 dark:bg-white/5">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder="Type / to use skills…"
              className="max-h-[120px] min-h-[20px] flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40"
            >
              <svg className="h-3.5 w-3.5 rotate-90" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">
            Sentiment is a headline heuristic, not advice.
          </p>
        </form>
      </div>

      {/* Side trigger tab — hidden when drawer is open */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Copilot"
        className={`fixed right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-2xl bg-indigo-600 px-2 py-4 text-white shadow-lg shadow-indigo-600/30 transition-all duration-300 hover:bg-indigo-500 active:scale-95 ${
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <BotIcon className="h-4 w-4" />
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Copilot
        </span>
        <SparkleIcon className="h-3 w-3 opacity-70" />
      </button>
    </>
  )
}
