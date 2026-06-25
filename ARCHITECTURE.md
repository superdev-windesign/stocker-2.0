# Portfolio Intelligence Hub — System Architecture

> Working name: **Stocker / Portfolio Intelligence Hub**
> A multi-user portfolio analytics & intelligence platform for Indian + US retail investors.
> **It does not execute trades** — it reads broker data, preserves lifetime transaction history,
> and turns it into analytics, alerts, and AI insights.

This document describes the **target architecture** that fully covers the PRD, and notes what is
**built today** vs **planned**. It supersedes the inline notes in the README.

---

## 1. Design principles

1. **Broker = source of truth for *your* data; market-data feed = source for *whole-market* data.**
   Brokers (Paytm/INDstocks) know your holdings and quotes; they are not built/licensed for
   market-wide screeners, fundamentals, or news — those come from an independent market-data layer.
2. **Lifetime history comes from the Tradebook import**, because no broker API returns lifetime trades.
3. **Pure analytics core** — all math (FIFO P&L, tax, rebalance, risk, opportunities) is provider-
   and user-agnostic pure functions; only the data-access/auth/jobs layers know about users/brokers.
4. **Adapters everywhere** — brokers, market-data providers, and notification channels sit behind
   interfaces so providers are swappable without touching business logic.
5. **Everything scoped by `user_id`** in the multi-user model; nothing global.

---

## 2. High-level topology

```
┌───────────────────────── CLIENTS ─────────────────────────┐
│  Web (React/Vite or Next.js)   ·   Mobile/PWA (push)        │
└───────────────┬────────────────────────────────────────────┘
                │ HTTPS  (JWT in httpOnly cookie)
┌───────────────▼──────────────── FRONTEND (Vercel) ─────────┐
│ Auth UI · Dashboard · Holdings · Stock Detail · Alerts ·    │
│ Copilot · Tax · Rebalance · Market Intel · Ledger/Import    │
│ Contexts: Auth, Portfolio, Alerts, Insights                 │
└───────────────┬────────────────────────────────────────────┘
                │  /api/*  (cookie/JWT)
┌───────────────▼──────────────── BACKEND (Render/Fly — STATIC egress IP) ┐
│ authMiddleware → req.userId  (every route scoped by user)               │
│ ── API routes ──────────────────────────────────────────────────────── │
│ /auth /portfolio /holdings /stock /ledger /alerts /notifications        │
│ /insights /agent /market /rebalance /tax /watchlist /broker             │
│ ── Domain libs ──────────────────────────────────────────────────────── │
│ auth  users  brokerAccounts(crypto)  ledger  analytics(pure)            │
│ alerts  notifications  insights  agent  metrics                         │
│ marketdata/   corporateActions   indicators                             │
│ brokers/  paytm · indstocks · (zerodha · groww)      ← adapter iface    │
│ providers/ notify: inapp · email · fcm · telegram · whatsapp            │
│ workers/  (BullMQ): alert-poll · eod-nav · daily-ai · market-refresh ·  │
│            corp-action-sync                                             │
└───┬──────────────┬───────────────┬──────────────┬──────────────┬───────┘
    │              │               │              │              │
┌───▼────┐   ┌─────▼─────┐   ┌─────▼──────┐  ┌────▼─────┐  ┌─────▼─────────────┐
│Postgres│   │   Redis   │   │   Queue    │  │ Brokers  │  │ Market data +     │
│(or     │   │ cache +   │   │ (BullMQ on │  │ Paytm /  │  │ LLM + Notify      │
│ Turso) │   │ live      │   │  Redis)    │  │ INDstocks│  │ Polygon/AV/Yahoo/ │
│per-user│   │ quotes    │   │            │  │ (static  │  │ NSE · OpenRouter ·│
│ rows   │   │           │   │            │  │  IP)     │  │ FCM/Telegram/SMTP │
└────────┘   └───────────┘   └────────────┘  └──────────┘  └───────────────────┘
```

---

## 3. Frontend

- **Stack (today):** React 18 + Vite + React Router + Tailwind + Recharts + lightweight-charts.
  **PRD target:** Next.js + shadcn/ui (only if SSR/SEO/marketing needed — see §16).
- **State:** React Contexts — `AuthContext` (session/provider), `PortfolioContext`
  (holdings + lifetime `journeys`), `AlertsContext` (inbox poll), `InsightsContext`.
- **Routes/Modules:** Dashboard, Holdings, Stock Detail, Ledger (tradebook import), Tax,
  Rebalance, Alerts, Copilot, Market Intel, Live.
- **Auth:** login/signup; JWT stored in **httpOnly cookie** (not localStorage) in multi-user mode.
- **Error isolation:** route-keyed `ErrorBoundary` so one page crash never blanks the app.

---

## 4. Backend

- **Stack (today):** Node + Express (ESM). **PRD target:** NestJS optional (structure/DI for a team).
- **Auth middleware** resolves `userId` from the JWT on every `/api/*` call; 401 otherwise.
- **Thin routes → domain libs.** Routes do no business logic; they call libs scoped by `userId`.
- **Adapter layers** (the seams that keep it swappable):
  - `brokers/` — `PriceProvider`/`AccountProvider` per broker (Paytm, INDstocks, future Zerodha/Groww).
  - `marketdata/` — market-wide data provider (Yahoo/AlphaVantage/NSE → Polygon/IEX).
  - `providers/notify` — `NotifyChannel` (in-app, email, FCM push, Telegram, WhatsApp).

---

## 5. Data architecture

**Store:** PostgreSQL (target) or Turso/libSQL (current). All tables carry `user_id` (multi-user).

```
users            (id, email, name, auth_provider, password_hash?, created_at)
broker_accounts  (id, user_id, provider, token_enc, meta, status, updated_at)   -- ENCRYPTED tokens
transactions     (id, user_id, security_id, symbol, name, exchange, type, date,
                  quantity, price, charges, currency, country, ext_id, source, …) -- lifetime ledger
corporate_actions(id, user_id|null, symbol, type DIVIDEND|SPLIT|BONUS, date, ratio/amount, applied)
alerts           (id, user_id, symbol, type, threshold, direction, channels, repeat, status, …)
notifications    (id, user_id, kind, title, body, symbol, read, created_at)      -- in-app inbox
insight_cache    (id, user_id, scope, period_key, text, model, inputs_hash, …)
nav_snapshots    (user_id, date, invested, current_value, realized_pnl, unrealized_pnl, …)
watchlist        (user_id, symbol, reason, added_at)
audit_log        (id, user_id, action, target, ip, at)                            -- compliance
```

- **Multi-tenancy:** start with **shared DB + `user_id`** (row-level). Move to **DB-per-tenant**
  (Turso supports it) for strict isolation / data-residency / easy per-user delete at scale.
- **Encryption at rest:** broker tokens encrypted with a server key (env/KMS); never plaintext.
- **Indexes:** `(user_id, symbol, date)` on transactions; `(user_id, status)` on alerts.

---

## 6. Broker integration layer

Interface (per broker):
```
AccountProvider { getHoldings(user), getOrders(user), getFunds(user) }
PriceProvider   { getQuotes(symbols), getCandles(symbol, tf), subscribe(symbols)→WS }
AuthProvider    { loginUrl()|usesApiKey, exchange(code), tokenStatus(user) }
```
- **Paytm Money** (India): OAuth token exchange; holdings/orders/funds; price-charts; live quote;
  WebSocket ticks (equity + index packets). **Built.**
- **INDstocks/INDmoney** (US+India): **API-key** auth (no OAuth); `/portfolio/...`, `/market/quotes/...`;
  requires **static-IP whitelist**. **Scaffolded** (paths/auth env-configurable).
- **Zerodha/Groww**: future adapters implementing the same interface (PRD multi-broker).
- **Key constraint:** broker market data is licensed for *your* trading — not bulk market scans or
  redistribution. So market-wide data does **not** come from here (see §7).

---

## 7. Market-Data Service (independent feed)

Covers what brokers can't/shouldn't: **indices, market-wide gainers/losers/most-active, breadth→
sentiment, fundamentals (P/E, ROE, mcap, yield), corporate-actions calendar, news**.

```
marketdata/ interface:
  indices()                 // Nifty/Sensex/BankNifty/S&P/Nasdaq/Dow
  movers(market)            // top gainers/losers/most active
  breadth(market)→sentiment // bullish/neutral/bearish
  fundamentals(symbol)      // P/E, ROE, mcap, dividend yield
  quote52w(symbol)          // 52-wk high/low, distance
  news(symbols)             // headlines + sentiment (Phase 2)
providers: yahoo · alphaVantage · nse (free tier)  →  polygon · iex (paid, SLA)
cache: Redis (indices ~15s, movers ~1m, fundamentals ~1d)
```
- **Shared across users** (market data is identical for everyone) — fetched once, cached, served to all.
- **Start free** (Yahoo/AlphaVantage/NSE + Paytm WS for indices); swap to **Polygon/IEX** behind the
  same interface when reliability/US-real-time/scale require it. **Not built yet.**

---

## 8. Corporate actions

- `corporate_actions` table + a **sync job** (vendor or broker feed).
- **Splits/bonus** → adjust historical qty & price in cost-basis math so journeys/charts stay correct.
- **Dividends** → recorded as ledger events (shown in Stock Detail timeline; included in total returns).
- **Not modeled today** (ledger is BUY/SELL only) — required for PRD M3 accuracy.

---

## 9. Analytics engine (pure, reused everywhere)

Provider/user-agnostic pure functions — the stable core:
- `ledger` — FIFO lots → realized/unrealized P&L, averages, dates, holding duration, **open/realized lots**.
- `tax` — India STCG/LTCG, harvesting, LTCG-readiness (from realized lots).
- `opportunities` — re-entry, top movers, lifetime summary, last-sold.
- `rebalance` — sector drift vs targets + trades.
- `indicators` — RSI, 200-DMA, oversold (from candles). **(indicators planned)**
- `portfolioMetrics`/`stockMetrics` — allocation, diversification, CAGR, volatility, drawdown, ATH/ATL.
**All built** except `indicators`.

---

## 10. Alerts & notifications

- **Rule engine** (`evaluateAlerts(priceMap, ctx)`) — price above/below, %move, 52-wk near,
  portfolio P&L, **re-entry/personal-history** ("below your last exit"). One-shot or repeating. **Built.**
- **Evaluation:** `alert-poll` worker pulls quotes for symbols with active alerts (per user), batches,
  respects broker rate limits, fires → `notify`. Manual `POST /alerts/evaluate-now` for testing.
- **Channels (`NotifyChannel`):** in-app inbox ✅, email ✅; **FCM push, Telegram, WhatsApp planned**
  (PRD recommends Push + Telegram).

---

## 11. AI / agentic layer

- **AI Analyst** (`insights`): compact computed metrics → LLM (OpenRouter; default
  `liquid/lfm-2.5-1.2b-thinking:free`, swappable) → daily/weekly narrative; cached by `inputs_hash`;
  **heuristic fallback** with no key. **Built.**
- **Copilot** (`agent`): tool-calling chat grounded in the portfolio snapshot; tools = list/create
  alerts; **no-tools retry** for small models; reads `content`/`reasoning`. **Built.**
- Token-frugal by design (send computed metrics, never raw ledger).

---

## 12. Caching & real-time

- **Redis:** holdings (~60s), quotes, market-data, LLM insight cache. Critical so N users don't each
  hammer brokers/vendors.
- **Live quotes:** one upstream WebSocket **per symbol**, fan out to all subscribed users (never N sockets).
- **Latency:** cache-first; background refresh; never block a request on a slow broker call.

---

## 13. Background jobs (BullMQ on Redis)

| Worker | Cadence | Does |
|---|---|---|
| `alert-poll` | market hours, ~2–5 min | quotes → evaluate → notify (per user) |
| `eod-nav` | daily close | write `nav_snapshots` (real portfolio-value trend) |
| `daily-ai` | daily | pre-generate AI summary → inbox |
| `market-refresh` | minutes | indices/movers/breadth → Redis |
| `corp-action-sync` | daily | dividends/splits → adjust ledger |

Replaces the current single in-process `node-cron` (fine for single-user; not for multi-user scale).

---

## 14. PRD module → architecture mapping

| PRD module | Components |
|---|---|
| M1 Dashboard | `portfolioMetrics`, `opportunities.lifetimeSummary`, CountrySplit, nav_snapshots trend |
| M2 Holdings Explorer | HoldingsTable + `marketdata.quote52w` (52-wk + distance) |
| M3 Stock Detail | StockJourney, Tradebook, `stockMetrics`, `corporateActions`, `indicators`, fundamentals |
| M4 Alerts | `alerts` engine + `notify` channels (in-app/email/push/telegram) |
| M5 Opportunity Finder | `opportunities` (re-entry) + `indicators` (oversold) + `marketdata` (52-wk low) |
| M6 Market Intelligence | **`marketdata` service** (indices, movers, breadth→sentiment) |
| M7 AI Analyst | `insights` + `agent` (OpenRouter) |

---

## 15. Security & compliance

- Broker tokens **encrypted at rest**; decrypt only in-request.
- **httpOnly/Secure/SameSite** cookies; CSRF tokens; per-route rate limiting.
- **Audit log** (who/what/when). **Data residency** = Turso/Postgres Mumbai region.
- Per-user **export & delete** (DPDP-friendly). Secrets in env/KMS, never in git.
- Static egress IP for broker API entitlement (INDstocks requires whitelisting).

---

## 16. Tech-stack decisions (keep vs migrate)

| Layer | Today | PRD asks | Recommendation |
|---|---|---|---|
| Frontend | React + Vite | Next.js + shadcn | Keep Vite unless SSR/SEO needed; Next is optional |
| Backend | Express | NestJS | Keep Express for MVP; Nest only for a larger team |
| DB | Turso (libSQL) | PostgreSQL | Turso is fine early; move to Postgres at multi-user scale |
| Push | in-app + email | Firebase + Telegram + WhatsApp | **Add FCM + Telegram** (genuine PRD gap) |
| Cache/Jobs | none / node-cron | Redis | **Add Redis + BullMQ** for multi-user |

Decide these **before** the multi-user build so you migrate once.

---

## 17. Deployment topology

```
Frontend  → Vercel (static)                      VITE_BACKEND_URL → backend
Backend   → Render/Fly (always-on, STATIC IP)    env: broker keys, OpenRouter, SMTP/FCM, DB, Redis
DB        → Turso (Mumbai) / managed Postgres
Redis     → managed (Upstash/Render)
Queue     → BullMQ on the same Redis
External  → Paytm/INDstocks · market-data vendor · OpenRouter · FCM/Telegram/SMTP
```
Free Render sleeps (breaks cron) and lacks static IP → use an always-on plan / static-IP add-on for production.

---

## 18. Roadmap (build once, in order)

1. **Multi-user foundation** — `users`, auth (JWT/Google), `user_id` scoping across all libs. *(keystone)*
2. **Stack decisions** — Postgres? Next? add FCM. Lock before building more.
3. **Per-user encrypted broker tokens** + per-user connect.
4. **Redis cache + BullMQ workers** (alerts/AI/NAV per user).
5. **Market-Data Service** (free tier) → indices, movers, sentiment, fundamentals (M6, M5 oversold).
6. **Corporate actions** (dividends/splits) → M3 accuracy.
7. **Push/Telegram channels** → close M4.
8. **Multi-broker** (Zerodha/Groww), US real-time, paid data, advanced analytics. *(Phase 2)*

---

## 19. Current implementation status (single-user MVP)

**Built:** ledger + Tradebook import (CSV/Excel, dedup, BSE-code→ticker), Stock Journey + per-share
tradebook, lifetime/portfolio P&L, FIFO realized/unrealized, Tax (CGT/harvest/LTCG-readiness), Risk &
concentration, Rebalancing drift, Re-entry/opportunity widgets, Alerts engine (in-app + email) + scheduler,
AI Analyst + agentic Copilot (OpenRouter), Paytm provider (live), INDstocks adapter (scaffold), currency-
aware India/US support, dashboard intelligence widgets.

**Not yet:** multi-user/auth, Redis/queue, Market-Data Service (M6), corporate actions, push/Telegram/
WhatsApp, indicators (RSI/200-DMA), fundamentals/news, multi-broker beyond Paytm.
