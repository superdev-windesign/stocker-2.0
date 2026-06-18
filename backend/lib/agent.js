// Stocker Copilot — an AGENTIC assistant. Runs an LLM (OpenRouter, gpt-4o) in a
// tool-calling loop: the model reasons over a compact portfolio snapshot (sent by the
// frontend) and can call tools to read live data or take actions (e.g. create alerts).
// DEPLOY-ONLY for the live model (sandbox egress blocks openrouter.ai); without a key it
// degrades to a deterministic rule-based responder so the Copilot still does something.
import { listAlerts, addAlert, ALERT_TYPES } from './alerts.js'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const MODEL = process.env.OPENROUTER_MODEL || 'liquid/lfm-2.5-1.2b-thinking:free'
const SITE_URL = process.env.OPENROUTER_SITE_URL || 'https://stocker-2-0-frontend.vercel.app'
const SITE_NAME = process.env.OPENROUTER_SITE_NAME || 'Stocker'
const MAX_STEPS = 5

// ── Tools the agent can call (OpenAI-compatible function schema) ──────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_alerts',
      description: 'List the user\'s existing price/portfolio alerts.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_alert',
      description:
        'Create a price or portfolio alert. Use REENTRY_ZONE/PRICE_BELOW for "tell me if X drops to/below price", PRICE_ABOVE for breakouts, NEAR_52W_LOW/HIGH for extremes, PORTFOLIO_PNL_PCT for portfolio-level.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Ticker, e.g. INFY. Omit for PORTFOLIO_PNL_PCT.' },
          type: { type: 'string', enum: ALERT_TYPES },
          threshold: { type: 'number', description: 'Price (₹) or percent depending on type.' },
          note: { type: 'string' },
        },
        required: ['type', 'threshold'],
      },
    },
  },
]

// Server-side tool implementations. Return JSON-serializable results.
async function runTool(name, args, actions) {
  if (name === 'list_alerts') {
    const alerts = await listAlerts()
    return alerts.map((a) => ({ symbol: a.symbol, type: a.type, threshold: a.threshold, status: a.status }))
  }
  if (name === 'create_alert') {
    const created = await addAlert({
      symbol: args.symbol || null,
      type: args.type,
      threshold: args.threshold,
      note: args.note || null,
      channels: ['inapp'],
    })
    actions.push({ kind: 'alert_created', summary: `${created.symbol || 'Portfolio'} ${created.type} ${created.threshold}` })
    return { ok: true, id: created.id }
  }
  return { error: `unknown tool ${name}` }
}

async function chat(messages, { useTools = true } = {}) {
  const body = { model: MODEL, messages, temperature: 0.3, max_tokens: 1000 }
  if (useTools) {
    body.tools = TOOLS
    body.tool_choice = 'auto'
  }
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': SITE_URL,
      'X-Title': SITE_NAME,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const err = new Error(`OpenRouter ${resp.status}: ${await resp.text()}`)
    err.status = resp.status
    throw err
  }
  const data = await resp.json()
  return data?.choices?.[0]?.message || {}
}

// Thinking models may return the answer in `reasoning` if `content` is empty.
const answerOf = (msg) => (msg?.content && msg.content.trim()) || (msg?.reasoning && msg.reasoning.trim()) || ''

const SYSTEM =
  'You are Stocker Copilot, an agentic portfolio assistant for an Indian retail investor (amounts in ' +
  'INR). You are given a JSON snapshot of the user\'s portfolio (holdings, lifetime P&L, tax position, ' +
  'rebalancing drift, re-entry opportunities, risk/concentration). Answer specifically using those ' +
  'numbers. You can call tools to list or create alerts when asked. Do NOT give prescriptive buy/sell ' +
  'advice — frame suggestions as considerations and cite the data. Be concise and concrete.'

// Rule-based fallback when no LLM key is configured.
function heuristicReply(message, context) {
  const t = context?.totals || {}
  const re = context?.reentry?.[0]
  const bits = []
  bits.push(
    `Portfolio ≈ ₹${Math.round(t.currentValue || 0).toLocaleString('en-IN')} (P&L ${t.totalPnlPct ?? '—'}%).`,
  )
  if (context?.tax?.totalTaxDue != null) bits.push(`Estimated CGT due this FY: ₹${Math.round(context.tax.totalTaxDue).toLocaleString('en-IN')}.`)
  if (re) bits.push(`Re-entry watch: ${re.symbol} is ${re.diffPct}% below your last exit.`)
  bits.push('(AI Copilot is in fallback mode — set OPENROUTER_API_KEY on the backend for full agentic chat.)')
  return bits.join(' ')
}

/**
 * Run one agentic turn.
 * @param {string} message   the user's message
 * @param {object} context   compact portfolio snapshot from the frontend
 * @param {Array} history    prior [{role:'user'|'assistant', content}]
 * @returns {{ reply, actions, model }}
 */
export async function runAgent(message, context = {}, history = []) {
  const actions = []
  if (!OPENROUTER_KEY) {
    return { reply: heuristicReply(message, context), actions, model: 'heuristic' }
  }

  const baseMessages = [
    { role: 'system', content: SYSTEM },
    { role: 'system', content: `Portfolio snapshot (JSON):\n${JSON.stringify(context)}` },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ]
  const messages = [...baseMessages]

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const msg = await chat(messages, { useTools: true })
      messages.push(msg)
      const calls = msg.tool_calls || []
      if (!calls.length) {
        const text = answerOf(msg)
        if (text) return { reply: text, actions, model: MODEL }
        break // empty answer — fall through to no-tools retry
      }
      for (const call of calls) {
        let args = {}
        try {
          args = JSON.parse(call.function.arguments || '{}')
        } catch {
          /* ignore bad args */
        }
        const result = await runTool(call.function.name, args, actions)
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
      }
    }
  } catch (err) {
    console.error('[stocker] agent (tools) failed, retrying without tools:', err.message)
  }

  // Fallback: many small/free models (incl. thinking models) don't support tool-calling.
  // Retry as a plain grounded chat so the Copilot still answers (just can't take actions).
  try {
    const msg = await chat(baseMessages, { useTools: false })
    const text = answerOf(msg)
    if (text) return { reply: text, actions, model: MODEL }
  } catch (err) {
    console.error('[stocker] agent (no-tools) failed:', err.message)
  }
  return { reply: heuristicReply(message, context), actions, model: 'heuristic' }
}
