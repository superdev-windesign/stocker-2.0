// Configurable LLM client (OpenAI-compatible). Works with any provider exposing the
// /chat/completions shape — OpenRouter, ZenMux (GLM), OpenAI, etc. — via env:
//   LLM_BASE_URL  (default https://openrouter.ai/api/v1)
//   LLM_API_KEY   (falls back to OPENROUTER_API_KEY)
//   LLM_MODEL     (falls back to OPENROUTER_MODEL, then a free default)
// Example for GLM 5.2:  LLM_BASE_URL=https://zenmux.ai/api/v1  LLM_MODEL=z-ai/glm-5.2
// DEPLOY-ONLY: the dev sandbox can't reach these hosts (egress); callers degrade gracefully.
const BASE = (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const KEY = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || ''
const MODEL = process.env.LLM_MODEL || process.env.OPENROUTER_MODEL || 'liquid/lfm-2.5-1.2b-thinking:free'
const SITE_URL = process.env.OPENROUTER_SITE_URL || 'https://stocker-2-0-frontend.vercel.app'
const SITE_NAME = process.env.OPENROUTER_SITE_NAME || 'Stocker'

export const llmConfigured = () => Boolean(KEY)
export const llmModel = () => MODEL

// Thinking models may return the answer in `reasoning` when `content` is empty.
export const answerOf = (msg) => (msg?.content && msg.content.trim()) || (msg?.reasoning && msg.reasoning.trim()) || ''

export async function llmChat(messages, { tools, temperature = 0.4, maxTokens = 1000 } = {}) {
  const body = { model: MODEL, messages, temperature, max_tokens: maxTokens }
  if (tools) {
    body.tools = tools
    body.tool_choice = 'auto'
  }
  const resp = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-Title': SITE_NAME,
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const e = new Error(`LLM ${resp.status}: ${await resp.text()}`)
    e.status = resp.status
    throw e
  }
  const data = await resp.json()
  return data?.choices?.[0]?.message || {}
}
