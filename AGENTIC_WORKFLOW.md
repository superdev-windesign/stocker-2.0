# Stocker — Agentic Workflow Architecture & Roadmap

> Living design doc for the AI/agentic layer of Stocker. Use it to remember **what** to
> build and **how** to build it on top of what already exists. Keep adding to it.
>
> Last updated: 2026-06-29

---

## 1. Purpose & guiding principles

Turn Stocker from a dashboard that *shows* data into an assistant that *interprets* it —
grounded entirely in the user's own portfolio.

**Principles (do not break these):**
1. **Grounded, not generic.** Every AI output must cite the user's real numbers (holdings,
   P&L, ledger, tax, news). No vague market commentary.
2. **Considerations, not advice.** Never give prescriptive buy/sell calls. Frame as
   "things to consider" + the data behind them. Always show a disclaimer.
3. **Cheap-first model tiering.** Use a small/fast model for high-volume tasks (per-article
   scoring) and a frontier model only for reasoning-heavy tasks (briefings, chat).
4. **Cache aggressively.** LLM calls are slow + cost money. Memoize by user + inputs hash.
5. **Graceful degradation.** Everything must still work (rule-based) when no API key is set
   — never hard-fail a page because the LLM is down. (This pattern already exists.)
6. **Provider-agnostic.** Go through the existing OpenAI-compatible client; never hard-wire
   one vendor's SDK.

---

## 2. What already exists (the foundation)

| File | What it does | State |
|---|---|---|
| `backend/lib/llm.js` | OpenAI-compatible chat client. Env: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (defaults to OpenRouter). `llmChat(messages,{tools,temperature,maxTokens})`, `llmConfigured()`, `answerOf()` | ✅ works; provider-agnostic |
| `backend/lib/agent.js` | `runAgent(message, context, history)` — tool-calling loop (`MAX_STEPS=5`), tools `list_alerts` + `create_alert`, grounded system prompt, **heuristic fallback** when no key | ✅ works (dummy w/o key) |
| `backend/lib/insights.js` | AI insights generation (feeds the dashboard "AI Insights" card) | ✅ exists |
| Copilot route (`runAgent` in `index.js`) | Chat endpoint the `/copilot` page calls | ✅ exists; off the navbar for now |
| `backend/lib/portfolioNews.js` | **Portfolio News v1** — merges Google News across top-10 holdings, tags w/ symbol/weight/P&L + **keyword sentiment heuristic**, ranks by weight×freshness | ✅ shipped (rule-based) |

**Key insight:** the agentic plumbing is built. Most "agentic" work below is (a) setting an
API key + good model, and (b) swapping heuristics for LLM reasoning over data we already fetch.

### Data sources already wired (LLM inputs are free / cheap)
- **Holdings** — `getDerivedHoldings(userId)` (qty, avg cost, live value, P&L, sector, country)
- **Ledger** — `listTransactions(userId)` (full buy/sell history)
- **Equity curve** — `getPortfolioHistory(userId, range)` (daily value/invested)
- **Live quotes / OHLCV** — `yahoo.quote`, `yahoo.chart`, `yahoo.fundamentals`, indices, sectors
- **News** — `gnews.search(query)` (Google News RSS, India-localized)
- **Reference** — `wiki.summary(query)` (Wikipedia profiles)
- **Tax / rebalance / re-entry / risk** — already computed in `analytics/*` + `opportunities.js`

---

## 3. Model strategy

Everything routes through `llm.js` (OpenAI `/chat/completions` shape). Pick models per task
via env; through OpenRouter you can target any vendor.

**Recommended tiering (default to the latest, most capable Claude models for reasoning):**

| Task | Tier | Why |
|---|---|---|
| Per-article news scoring (high volume, ~30/refresh) | **small/fast** (e.g. Claude Haiku 4.5) | cheap, runs often, simple classification |
| Daily/weekly briefing, Copilot chat, rebalance reasoning | **frontier** (e.g. Claude Sonnet 4.6 / Opus 4.8) | needs real reasoning over numbers |
| One-off deep "explain my portfolio" | **frontier** (Opus 4.8) | quality over cost |

Set per call with the existing client (extend `llmChat` to accept a `model` override, or run
two configured clients). Env today: `LLM_MODEL` (single). **To-do:** add `LLM_MODEL_FAST` for
the cheap tier. On OpenRouter these are the `anthropic/claude-*` family; any OpenAI-compatible
model also works.

> When wiring Anthropic specifically (model ids, params, streaming, caching, tool schemas),
> consult the **claude-api** skill rather than guessing.

---

## 4. Feature roadmap (priority order)

Each feature lists: **inputs we already have → LLM's job → output → where it surfaces.**

### 4.1 Smart Portfolio News v2 — LLM impact scoring  ⭐ next
Upgrade `portfolioNews.js` (v1 keyword heuristic → real reasoning).
- **Inputs:** each news item (headline + source) + the holding it maps to (symbol, your qty,
  avg cost, current P&L, weight).
- **LLM job (fast tier, batched):** for each article return `{ sentiment, impact: high|med|low,
  one_line: "why this matters to *your* position" }`. Batch many headlines in one call to save cost.
- **Output:** the existing `PortfolioNews` card, but each row gets an **impact badge** + a
  one-line "what it means for you" instead of a generic sentiment dot.
- **Build notes:** cache by `hash(headlines)` for 30–60 min. Keep the keyword heuristic as the
  no-key fallback. Cap articles sent to the LLM (top ~15 by weight×freshness).

### 4.2 Daily / Weekly Portfolio Briefing
- **Inputs:** equity curve (period return), top movers today, holdings with notable news,
  tax position, rebalance drift, re-entry watch.
- **LLM job (frontier):** write a 4–6 bullet briefing — "what moved your portfolio, what to
  watch, any considerations" — strictly from the numbers.
- **Output:** a "Today's briefing" card at the top of Portfolio Overview; optionally pushed
  via the existing notification system (see Phase 7 push/Telegram).
- **Build notes:** generate once/day server-side (cron already exists in `scheduler.js`), store
  like a NAV snapshot, serve cached. Regenerate-on-demand button.

### 4.3 Copilot v2 — full agentic tool calling  ⭐ confirmed scope
The drawer shell (`CopilotDrawer.jsx`) is already built and lives as a global slide-in panel
(right-edge tab → swipe left to open, swipe right to close). The next phase wires it to a
full tool-calling backend so the user can talk to it naturally and it can both *answer* and
*act* across the entire app.

**Goal:** one conversational interface to everything — market, portfolio, actions, navigation.

#### Read tools (safe, auto-execute)
| Tool | What it fetches |
|---|---|
| `get_holdings` | All current holdings with qty, avg cost, live value, P&L, sector |
| `get_holding(symbol)` | Deep detail on one stock — journey, transactions, P&L history |
| `get_portfolio_history(range)` | Equity curve for 1M/3M/6M/1Y |
| `get_tax_summary` | Realized STCG/LTCG, harvestable loss, LTCG-ready candidates |
| `get_rebalance_drift` | Sector drift vs. user targets |
| `get_risk_summary` | Concentration, sector over-exposure |
| `get_reentry_opportunities` | Stocks below last exit price |
| `search_stock(query)` | AlphaVantage/Yahoo symbol search |
| `get_quote(symbol)` | Live price, day change, 52w high/low |
| `get_ohlcv(symbol, range)` | OHLCV chart data |
| `get_fundamentals(symbol)` | PE, EPS, market cap, revenue, sector |
| `get_stock_news(symbol)` | Recent headlines for any ticker |
| `get_market_indices` | NIFTY/SENSEX/BANK NIFTY live |
| `get_sector_performance` | Sector heatmap |
| `get_earnings_calendar` | Upcoming earnings for held stocks |

#### Action tools (require clear user intent — return ✓ chip + allow undo)
| Tool | What it does |
|---|---|
| `create_alert(symbol, condition, value)` | Price/change alert — already exists |
| `add_to_watchlist(symbol, listId?)` | Add ticker to a watchlist |
| `create_watchlist(name)` | Create a new watchlist |
| `add_transaction(...)` | Log a buy/sell in the ledger |
| `set_rebalance_target(sector, pct)` | Save a sector target |

#### App navigation tools (agent can drive the UI)
| Tool | What it does |
|---|---|
| `navigate_to(route)` | Push a route (e.g. `/stock/sym/RELIANCE`, `/tax`, `/alerts`) |
| `open_section(tab)` | Switch dashboard tab (`overview`, `holdings`, `analytics`, `activity`) |

#### Architecture
- Backend: register all tools in `agent.js` with JSON Schema; keep `MAX_STEPS=8`
- Streaming: add `llmStream()` to `llm.js` → SSE endpoint → drawer shows tokens as they arrive
- Fast model (`LLM_MODEL_FAST`) for quote/news lookups; frontier for reasoning/chat
- Every action tool emits a structured `{ kind, summary, undo? }` the drawer renders as a chip
- Fallback: if no API key, all read tools still work (they hit real data); only LLM reasoning degrades to heuristic

### 4.4 Reasoning assists on existing pages
Small, focused LLM explainers next to existing analytics:
- **Rebalance:** "why these trades" narrative for the computed drift.
- **Tax:** explain harvest candidates + LTCG-readiness in plain language.
- **Re-entry:** explain why a stock is flagged + the suggested zone.
- **Risk:** narrate concentration / sector over-exposure.
- Each is a single grounded `llmChat` call over the already-computed numbers, cached.

### 4.5 Earnings & events digest
- **Inputs:** holdings → upcoming earnings/dividends/splits (AlphaVantage `EARNINGS_CALENDAR`,
  Yahoo, or news mining).
- **LLM job:** summarize "what's coming up for your stocks this week."
- **Output:** Overview card / briefing section.

### 4.6 Natural-language portfolio Q&A (RAG-lite)
"How did my IT stocks do this quarter?" — Copilot already grounds on the snapshot; extend the
context builder to include per-sector and per-period rollups so answers are precise.

---

## 5. Agent architecture (how the loop should work)

```
User / cron
   │
   ▼
context builder  ──►  compact JSON snapshot (holdings, totals, tax, risk, news refs)
   │                  [keep it small — summarize, don't dump raw rows]
   ▼
llmChat(system + snapshot + history + message, tools)
   │
   ├─ tool_calls? ──► runTool() (read live data / take confirmed action) ──┐
   │                                                                        │ (loop ≤ MAX_STEPS)
   └─ final text ◄──────────────────────────────────────────────────────--┘
   │
   ▼
{ reply, actions[], model }   ──►  UI renders answer + action chips
```

**Conventions:**
- **System prompt** always states: grounded, INR, no prescriptive advice, cite numbers.
- **Snapshot** is summarized (totals + top N), never the full ledger — keep tokens low.
- **Tools** split into *read* (safe, auto) and *action* (require explicit user intent / confirm).
- **Streaming** for chat UX (SSE) — add to `llm.js` as `llmStream()`.
- **Fallback** at every layer: no key → heuristic; tools unsupported → plain grounded chat
  (already implemented in `agent.js`).

---

## 6. Guardrails & safety
- Disclaimer on every AI surface: *"AI-generated, grounded in your data — not financial advice."*
- No buy/sell directives; only considerations + the data.
- Action tools never fire without clear user intent; show what was done + allow undo.
- Rate-limit per user; cache to avoid repeat spend.
- Log model + token usage for cost visibility.

---

## 7. Cost & caching
- Memoize LLM results by `hash(inputs)` (news 30–60 min, briefing 1/day, explainers until
  underlying numbers change).
- Batch (one call for many headlines).
- Fast tier for volume, frontier tier for depth.
- Hard cap tokens (`maxTokens`) and steps (`MAX_STEPS`).

---

## 8. Env vars
```
LLM_BASE_URL   # default https://openrouter.ai/api/v1
LLM_API_KEY    # or OPENROUTER_API_KEY — without it, everything degrades to heuristics
LLM_MODEL      # frontier model for reasoning/chat
LLM_MODEL_FAST # (TO ADD) cheap model for per-article scoring
```
Sandbox note: dev egress can't reach OpenRouter; the live model only runs on deploy. Local dev
exercises the heuristic fallbacks.

---

## 9. Build checklist
- [ ] Add `LLM_MODEL_FAST` + optional `model` override in `llmChat`
- [ ] **News v2:** batched LLM scoring in `portfolioNews.js` (impact + one-liner), keep heuristic fallback
- [ ] **Briefing:** `lib/briefing.js` + daily cron + `GET /api/portfolio/briefing` + Overview card
- [ ] **Copilot v2:** add read/action tools; SSE streaming; re-add Copilot to navbar when ready
- [ ] **Explainers:** rebalance / tax / re-entry / risk grounded one-call summaries
- [ ] **Earnings digest:** events source + summary
- [ ] Disclaimers + per-user rate limit + token/cost logging
- [ ] Tests for fallbacks (no key, tool-unsupported model)

---

## 10. Related docs
- `alphavantage-stock-api.md` — market data API reference (also a skill)
- Memory: `project_stocker.md` — overall project state / phases
