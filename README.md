# 📈 Stocker

A **Paytm Money** portfolio analytics dashboard + live market-data app, built with
React + React Router + Tailwind + Recharts + lightweight-charts (TradingView).

Two views (top nav):
- **Portfolio** (`/`) — full analytics dashboard: summary cards, holdings table (search/sort/
  paginate/CSV export), sector & market-cap allocation, performance vs Nifty/Sensex, advanced
  analytics + insights, an investment-journey timeline, and a per-stock detail page (`/stock/:id`)
  with a price chart (avg-buy line + buy/sell markers), ATH/ATL, CAGR/volatility/drawdown.
- **Live** (`/live`) — 5 Nifty 50 stocks streamed over the WebSocket (RELIANCE, TCS, HDFCBANK,
  INFY, ICICIBANK).

Dark + light theme (toggle in the header).

### Data scope (API-only)
The Paytm Open API provides **current holdings, today's orders, live prices, and historical price
candles** — but **not** lifetime trade history. So realized P&L, multi-year trade history, and the
full buy/sell timeline show honest "import tradebook" empty states. Sector / market-cap / Nifty /
Sensex come from a small **bundled static dataset** (`src/data/`). Everything else is real Paytm data.

## How it works

The browser connects directly to Paytm's broadcast WebSocket:

```
wss://developer-ws.paytmmoney.com/broadcast/user/v1/data?x_jwt_token=<PUBLIC_ACCESS_TOKEN>
```

It subscribes with a JSON preference array (`actionType: ADD`, `modeType: LTP`, `scripType: EQUITY`,
`exchangeType: NSE`, per scrip), then decodes the binary tick packets and updates the cards + chart.

> **Important — about the token:** the WebSocket authenticates with a **public access token**, not the
> raw API key/secret. That token is minted through Paytm's interactive login flow and is valid only until
> midnight IST, so you generate it fresh each day. The API key/secret cannot stream on their own and must
> never be shipped in browser code — that's why this app takes the token, not the secret.

## Token generation (the login flow)

Paytm's token exchange (`request_token` → `access_token`) **cannot** run in the browser: the
`gettoken` endpoint blocks cross-origin calls, and your `api_secret` must stay server-side. So the
**standalone Express backend** (`backend/`) holds the secret, does the exchange, and proxies Paytm's
REST APIs. All Paytm + Turso logic lives in one place (`backend/lib/paytm.js`); the server runs on
port **5174**.

Paytm's **Return URL points at the frontend root**, so after login Paytm redirects to
`<frontend>/?requestToken=...`. The React app picks that up and POSTs it to the backend's
`/api/exchange`:

```
[browser]  /api/login ─▶ Paytm login page ─▶ (Return URL) <app>/?requestToken=...
                                                │
[React]    POST /api/exchange { request_token } ─▶ backend exchanges with api_key + api_secret
                                                │
                                  stores token set in Turso, returns public_access_token
[React]    auto-connects the websocket; GET /api/token re-reads it on refresh
```

**One-time Paytm Developer Portal setup:** set your app's **Return URL** to the frontend root —
`http://localhost:5173/` for local dev, or your deployed frontend URL in production.

## Project structure

This is a monorepo with two independent workspaces:

```
frontend/   # React + Vite single-page app (port 5173)
backend/    # standalone Express API — token exchange + Paytm REST proxy (port 5174)
```

They share nothing at runtime: the frontend talks to the backend over HTTP (`VITE_BACKEND_URL`),
so you can run, deploy, and scale them separately.

## Setup

A single `npm install` at the repo root installs **both** workspaces (npm workspaces).

```bash
npm install

# Backend secrets (Paytm + Turso):
cp backend/.env.example backend/.env      # fill in PAYTM_API_KEY, PAYTM_API_SECRET, TURSO_*

# Frontend config (optional — sensible dev defaults already point at :5174):
cp frontend/.env.example frontend/.env

npm start                                 # runs backend (:5174) AND frontend (:5173) together
```

Open http://localhost:5173, click **🔑 Login with Paytm & generate token**, sign in, and you'll land
back in the app already connected. (Already have a token? Paste it manually instead.) Live ticks flow
only during NSE market hours; outside them the app connects but shows no price movement.

### Session persistence
After you log in, the backend stores the session in **Turso** (libSQL), so restarts never force a
re-login (the TokenGate's **"Copy stored token from DB"** button pulls it via `/api/token/retrieve`).
Paytm tokens expire at midnight IST — once expired, the saved session is auto-discarded and you log
in again. `Logout` clears the stored session.

## Deploy

The two workspaces deploy independently:

- **Backend** — a long-running Node/Express service (Render, Railway, Fly.io, a VM, etc.). Set
  `PAYTM_API_KEY`, `PAYTM_API_SECRET`, `TURSO_URL`, `TURSO_AUTH_TOKEN`, and `FRONTEND_URL` (the
  deployed frontend origin, used for CORS). Run with `npm run server`.
- **Frontend** — a static build (`npm run build` → `frontend/dist/`) on any static host (Vercel,
  Netlify, Cloudflare Pages, …). Set `VITE_BACKEND_URL` to the deployed backend's URL at build time.
- In the Paytm Developer Portal set the **Return URL** to the deployed **frontend** root.

## Scripts (run from the repo root)

- `npm start` / `npm run dev` — run backend + frontend together (use this)
- `npm run dev:backend` — backend only (Express, port 5174, with `--watch`)
- `npm run dev:frontend` — frontend only (Vite, port 5173)
- `npm run server` — backend in production mode (no watch)
- `npm run build` — production build into `frontend/dist/`
- `npm run preview` — preview the production frontend build

## Project layout

```
backend/
  index.js                  # Express server: login/exchange/token + Paytm REST proxy
  lib/paytm.js              # shared Turso + Paytm logic
frontend/
  src/
    config/stocks.js        # the 5 scrips + subscription preferences + id lookup
    services/parseBinary.js # browser decoder for Paytm binary tick packets
    services/paytmSocket.js # WebSocket connect / subscribe / reconnect
    services/portfolioApi.js# fetch wrappers around the backend /api/*
    hooks/useLiveQuotes.js  # owns the socket; exposes { status, error, quotes, history }
    components/             # TokenGate, ConnectionBadge, StockCard, PriceChart
    App.jsx                 # token gate → dashboard
```

## Extending

Add or change stocks in [`frontend/src/config/stocks.js`](frontend/src/config/stocks.js) — each entry
needs `symbol`, `name`, and the NSE `scripId` (security id). To show OHLC / depth, switch `modeType`
to `QUOTE` or `FULL` in the preferences; the decoder already handles those packet types.
