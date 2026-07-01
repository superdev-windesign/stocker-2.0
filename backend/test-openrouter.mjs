// Quick test — OpenRouter with qwen/qwen3-coder:free
// Run: node test-openrouter.mjs
// Delete this file once confirmed working.
import 'dotenv/config'

const API_KEY = process.env.OPENROUTER_API_KEY
const MODEL   = process.env.OPENROUTER_MODEL || 'qwen/qwen3-coder:free'

if (!API_KEY) { console.error('OPENROUTER_API_KEY not set in .env'); process.exit(1) }

console.log(`Testing model: ${MODEL}`)
console.log('Sending request to OpenRouter...\n')

const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || '',
    'X-Title': process.env.OPENROUTER_SITE_NAME || 'Stocker',
  },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: 'What is the meaning of life? Answer in one sentence.' }],
  }),
})

const json = await res.json()

if (!res.ok) {
  console.error('API error:', res.status, JSON.stringify(json, null, 2))
  process.exit(1)
}

const reply = json.choices?.[0]?.message?.content
console.log('Response:', reply)
console.log('\nUsage:', json.usage)
console.log('\n✓ OpenRouter is working correctly.')
