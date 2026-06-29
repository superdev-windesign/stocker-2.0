---
name: alphavantage-stock-api
description: Use this skill when working with Alpha Vantage Stock API for fetching stock prices, OHLCV data, technical indicators, forex, crypto, commodities, economic data, or fundamental company data. Triggers on mentions of Alpha Vantage, stock market API, TIME_SERIES, GLOBAL_QUOTE, RSI, MACD, SMA, EMA, intraday data, daily adjusted prices, company overview, earnings, balance sheet, income statement, cash flow, forex exchange rates, crypto prices, commodity prices, GDP, CPI, treasury yield, or building stock market dashboards/tools. Essential for developers integrating real-time or historical financial market data into applications.
compatibility: Requires a free or premium Alpha Vantage API key from https://www.alphavantage.co/support/#api-key. Base URL for all calls is https://www.alphavantage.co/query. Supports JSON and CSV output. Free tier has rate limits (25 requests/day standard). Premium plans unlock higher limits, realtime data, and premium endpoints.
---
 
# Alpha Vantage Stock API Skill
 
Complete reference for integrating Alpha Vantage financial market data APIs.
 
## Overview
 
**Alpha Vantage** provides financial market data via REST APIs:
- 📈 Core Stock Time Series (intraday, daily, weekly, monthly)
- 🏦 Fundamental Data (financials, earnings, dividends, splits)
- 🧠 Alpha Intelligence (news sentiment, insider transactions, top movers)
- 💱 Forex (FX) exchange rates and time series
- ₿ Cryptocurrency exchange rates and time series
- 🛢️ Commodities (gold, oil, gas, agricultural)
- 📊 Economic Indicators (GDP, CPI, inflation, unemployment)
- 📐 Technical Indicators (50+ indicators: SMA, EMA, RSI, MACD, BBANDS, etc.)
**Base URL:** `https://www.alphavantage.co/query`
 
**All requests require:** `apikey=YOUR_API_KEY` as a query parameter.
 
**Free API key:** https://www.alphavantage.co/support/#api-key
 
---
 
## Universal Parameters (apply to most endpoints)
 
| Parameter | Values | Default | Notes |
|---|---|---|---|
| `datatype` | `json`, `csv` | `json` | Output format |
| `outputsize` | `compact`, `full` | `compact` | `compact` = last 100 points; `full` = 20+ years. `full` requires premium on some endpoints |
| `apikey` | your key | — | Required on all calls |
| `entitlement` | `realtime`, `delayed` | historical | Premium only. `realtime` = live data; `delayed` = 15-min delay |
 
---
 
## 1. Core Stock Time Series APIs
 
### Quick Pattern
```
https://www.alphavantage.co/query?function=<FUNCTION>&symbol=<TICKER>&apikey=<KEY>
```
 
### Symbol Format by Exchange
| Exchange | Format | Example |
|---|---|---|
| US (NYSE/NASDAQ) | `TICKER` | `IBM`, `AAPL` |
| UK (London) | `TICKER.LON` | `TSCO.LON` |
| Canada (TSX) | `TICKER.TRT` | `SHOP.TRT` |
| Canada (TSXV) | `TICKER.TRV` | `GPV.TRV` |
| Germany (XETRA) | `TICKER.DEX` | `MBG.DEX` |
| India (BSE) | `TICKER.BSE` | `RELIANCE.BSE` |
| China (Shanghai) | `TICKER.SHH` | `600104.SHH` |
| China (Shenzhen) | `TICKER.SHZ` | `000002.SHZ` |
 
---
 
### 1.1 Intraday — `TIME_SERIES_INTRADAY` 🔒 Premium
 
Returns current and 20+ years of historical intraday OHLCV data including pre/post market.
 
**Required params:** `function`, `symbol`, `interval`, `apikey`
 
**Key params:**
 
| Param | Values | Notes |
|---|---|---|
| `interval` | `1min`, `5min`, `15min`, `30min`, `60min` | Required |
| `adjusted` | `true`, `false` | Default `true` — split/dividend adjusted |
| `extended_hours` | `true`, `false` | Default `true` — includes pre/post market |
| `month` | `YYYY-MM` | Query specific historical month (e.g. `2009-01`) |
| `outputsize` | `compact`, `full` | `full` = last 30 days or full month if `month` set |
 
**Examples:**
```
# Latest 100 bars (5-min)
https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&apikey=demo
 
# Full 30-day intraday
https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&outputsize=full&apikey=demo
 
# Specific historical month
https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=IBM&interval=5min&month=2009-01&outputsize=full&apikey=demo
```
 
---
 
### 1.2 Daily — `TIME_SERIES_DAILY` ✅ Free
 
Raw (as-traded) daily OHLCV. Compact = last 100 days. Full = 20+ years (premium for full).
 
```
https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=IBM&apikey=demo
https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=IBM&outputsize=full&apikey=demo
```
 
---
 
### 1.3 Daily Adjusted — `TIME_SERIES_DAILY_ADJUSTED` 🔒 Premium
 
Daily OHLCV + adjusted close + split/dividend history. 20+ years.
 
```
https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=IBM&apikey=demo
```
 
---
 
### 1.4 Weekly — `TIME_SERIES_WEEKLY` ✅ Free
 
Weekly OHLCV (last trading day of each week). 20+ years.
 
```
https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=IBM&apikey=demo
```
 
---
 
### 1.5 Weekly Adjusted — `TIME_SERIES_WEEKLY_ADJUSTED` ✅ Free
 
Weekly OHLCV + adjusted close + dividend. 20+ years.
 
```
https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol=IBM&apikey=demo
```
 
---
 
### 1.6 Monthly — `TIME_SERIES_MONTHLY` ✅ Free
 
Monthly OHLCV (last trading day of each month). 20+ years.
 
```
https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=IBM&apikey=demo
```
 
---
 
### 1.7 Monthly Adjusted — `TIME_SERIES_MONTHLY_ADJUSTED` ✅ Free
 
Monthly OHLCV + adjusted close + dividend. 20+ years.
 
```
https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=IBM&apikey=demo
```
 
---
 
### 1.8 Quote Endpoint — `GLOBAL_QUOTE` ✅ Free (EOD) / 🔒 Premium (realtime)
 
Latest price + volume for a single ticker. Updated EOD on free tier.
 
**Required params:** `function`, `symbol`, `apikey`
 
```
https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=demo
 
# Realtime (premium)
https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&entitlement=realtime&apikey=YOUR_KEY
```
 
**Response fields:** `01. symbol`, `02. open`, `03. high`, `04. low`, `05. price`, `06. volume`, `07. latest trading day`, `08. previous close`, `09. change`, `10. change percent`
 
---
 
### 1.9 Realtime Bulk Quotes — `REALTIME_BULK_QUOTES` 🔒 Premium
 
Up to 100 US tickers per call. Includes extended hours.
 
```
https://www.alphavantage.co/query?function=REALTIME_BULK_QUOTES&symbol=MSFT,AAPL,IBM&apikey=demo
```
 
---
 
### 1.10 Symbol Search — `SYMBOL_SEARCH` ✅ Free
 
Search tickers by keyword. Returns match scores. Good for autocomplete.
 
```
https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=microsoft&apikey=demo
https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=tesco&apikey=demo
```
 
---
 
### 1.11 Market Status — `MARKET_STATUS` ✅ Free
 
Current open/closed status of major global trading venues (equities, forex, crypto).
 
```
https://www.alphavantage.co/query?function=MARKET_STATUS&apikey=demo
```
 
---
 
## 2. Fundamental Data APIs
 
### 2.1 Company Overview — `OVERVIEW` ✅ Free
 
Company description, sector, market cap, P/E, EPS, dividend yield, 52-week range, analyst targets, beta, and more.
 
```
https://www.alphavantage.co/query?function=OVERVIEW&symbol=IBM&apikey=demo
```
 
---
 
### 2.2 Income Statement — `INCOME_STATEMENT` ✅ Free
 
Annual and quarterly income statements. Revenue, gross profit, EBITDA, net income, EPS.
 
```
https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=IBM&apikey=demo
```
 
---
 
### 2.3 Balance Sheet — `BALANCE_SHEET` ✅ Free
 
Annual and quarterly balance sheets. Assets, liabilities, equity, cash.
 
```
https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=IBM&apikey=demo
```
 
---
 
### 2.4 Cash Flow — `CASH_FLOW` ✅ Free
 
Annual and quarterly cash flow statements. Operating, investing, financing activities.
 
```
https://www.alphavantage.co/query?function=CASH_FLOW&symbol=IBM&apikey=demo
```
 
---
 
### 2.5 Earnings — `EARNINGS` ✅ Free
 
Annual and quarterly EPS history + surprise percentages.
 
```
https://www.alphavantage.co/query?function=EARNINGS&symbol=IBM&apikey=demo
```
 
---
 
### 2.6 Earnings Estimates — `EARNINGS_ESTIMATES` 🔒 Premium
 
Analyst consensus EPS estimates for upcoming quarters.
 
```
https://www.alphavantage.co/query?function=EARNINGS_ESTIMATES&symbol=IBM&apikey=demo
```
 
---
 
### 2.7 Dividends — `DIVIDENDS` ✅ Free
 
Full dividend history including ex-date, record date, payment date, amount.
 
```
https://www.alphavantage.co/query?function=DIVIDENDS&symbol=IBM&apikey=demo
```
 
---
 
### 2.8 Splits — `SPLITS` ✅ Free
 
Full stock split history.
 
```
https://www.alphavantage.co/query?function=SPLITS&symbol=IBM&apikey=demo
```
 
---
 
### 2.9 Shares Outstanding — `SHARES_OUTSTANDING` ✅ Free
 
Historical shares outstanding over time.
 
```
https://www.alphavantage.co/query?function=SHARES_OUTSTANDING&symbol=IBM&apikey=demo
```
 
---
 
### 2.10 ETF Profile — `ETF_PROFILE` ✅ Free
 
ETF holdings, sector allocation, net assets.
 
```
https://www.alphavantage.co/query?function=ETF_PROFILE&symbol=QQQ&apikey=demo
```
 
---
 
### 2.11 Listing Status — `LISTING_STATUS` ✅ Free
 
Active and delisted stocks/ETFs. Filter by date and state.
 
| Param | Values | Notes |
|---|---|---|
| `date` | `YYYY-MM-DD` | Optional. Snapshot on that date |
| `state` | `active`, `delisted` | Default `active` |
 
```
https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=demo
https://www.alphavantage.co/query?function=LISTING_STATUS&date=2010-01-01&state=delisted&apikey=demo
```
 
---
 
### 2.12 Earnings Calendar — `EARNINGS_CALENDAR` ✅ Free
 
Upcoming earnings releases for the next 3 or 12 months.
 
| Param | Values | Notes |
|---|---|---|
| `symbol` | ticker | Optional. Omit for full market calendar |
| `horizon` | `3month`, `6month`, `12month` | Default `3month` |
 
```
https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&apikey=demo
https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&symbol=IBM&horizon=12month&apikey=demo
```
 
---
 
### 2.13 IPO Calendar — `IPO_CALENDAR` ✅ Free
 
Upcoming IPOs.
 
```
https://www.alphavantage.co/query?function=IPO_CALENDAR&apikey=demo
```
 
---
 
## 3. Alpha Intelligence APIs
 
### 3.1 News & Sentiment — `NEWS_SENTIMENT` ✅ Free
 
Live and historical news + AI sentiment scores per ticker, topic, or category.
 
| Param | Values | Notes |
|---|---|---|
| `tickers` | `IBM,AAPL` | Comma-separated tickers |
| `topics` | see below | Filter by topic |
| `time_from` / `time_to` | `YYYYMMDDTHHMM` | Date range |
| `sort` | `LATEST`, `EARLIEST`, `RELEVANCE` | Default `LATEST` |
| `limit` | 1–1000 | Default 50 |
 
**Topics:** `blockchain`, `earnings`, `ipo`, `mergers_and_acquisitions`, `financial_markets`, `economy_fiscal`, `economy_monetary`, `economy_macro`, `energy_transportation`, `finance`, `life_sciences`, `manufacturing`, `real_estate`, `retail_wholesale`, `technology`
 
```
https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=AAPL&apikey=demo
https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=technology&apikey=demo
```
 
---
 
### 3.2 Top Gainers & Losers — `TOP_GAINERS_LOSERS` ✅ Free
 
Top 20 gainers, losers, and most actively traded US tickers (refreshed every 15 min during market hours).
 
```
https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=demo
```
 
---
 
### 3.3 Insider Transactions — `INSIDER_TRANSACTIONS` ✅ Free
 
Recent insider buy/sell activity for any US ticker.
 
```
https://www.alphavantage.co/query?function=INSIDER_TRANSACTIONS&symbol=IBM&apikey=demo
```
 
---
 
### 3.4 Institutional Holdings — `INSTITUTIONAL_HOLDINGS` 🔒 Premium
 
13F institutional holdings data.
 
```
https://www.alphavantage.co/query?function=INSTITUTIONAL_HOLDINGS&symbol=IBM&apikey=demo
```
 
---
 
### 3.5 Earnings Call Transcript — `EARNINGS_CALL_TRANSCRIPT` 🔒 Premium
 
Full transcript of earnings calls.
 
| Param | Notes |
|---|---|
| `symbol` | Required |
| `quarter` | e.g. `2024Q1` |
 
```
https://www.alphavantage.co/query?function=EARNINGS_CALL_TRANSCRIPT&symbol=IBM&quarter=2024Q1&apikey=demo
```
 
---
 
### 3.6 Analytics (Fixed Window) — `ANALYTICS_FIXED_WINDOW` 🔒 Premium
 
Statistical analytics over a fixed time window: mean return, variance, Sharpe ratio, correlation matrix.
 
---
 
### 3.7 Analytics (Sliding Window) — `ANALYTICS_SLIDING_WINDOW` 🔒 Premium
 
Same analytics computed over a rolling/sliding window.
 
---
 
## 4. Forex (FX) APIs
 
### 4.1 Exchange Rates — `CURRENCY_EXCHANGE_RATE` ✅ Free
 
Realtime exchange rate for any physical or digital currency pair.
 
```
https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=JPY&apikey=demo
https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=BTC&to_currency=USD&apikey=demo
```
 
---
 
### 4.2 FX Intraday — `FX_INTRADAY` 🔒 Premium
 
```
https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=EUR&to_symbol=USD&interval=5min&apikey=demo
```
 
**interval:** `1min`, `5min`, `15min`, `30min`, `60min`
 
---
 
### 4.3 FX Daily — `FX_DAILY` ✅ Free
 
```
https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=EUR&to_symbol=USD&apikey=demo
```
 
---
 
### 4.4 FX Weekly — `FX_WEEKLY` ✅ Free
 
```
https://www.alphavantage.co/query?function=FX_WEEKLY&from_symbol=EUR&to_symbol=USD&apikey=demo
```
 
---
 
### 4.5 FX Monthly — `FX_MONTHLY` ✅ Free
 
```
https://www.alphavantage.co/query?function=FX_MONTHLY&from_symbol=EUR&to_symbol=USD&apikey=demo
```
 
---
 
## 5. Cryptocurrency APIs
 
### 5.1 Crypto Exchange Rate — `CURRENCY_EXCHANGE_RATE` ✅ Free
 
Same endpoint as FX. Use crypto symbols (BTC, ETH, etc.).
 
```
https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=BTC&to_currency=USD&apikey=demo
```
 
---
 
### 5.2 Crypto Intraday — `CRYPTO_INTRADAY` 🔒 Premium
 
```
https://www.alphavantage.co/query?function=CRYPTO_INTRADAY&symbol=ETH&market=USD&interval=5min&apikey=demo
```
 
---
 
### 5.3 Crypto Daily — `DIGITAL_CURRENCY_DAILY` ✅ Free
 
```
https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_DAILY&symbol=BTC&market=USD&apikey=demo
```
 
---
 
### 5.4 Crypto Weekly — `DIGITAL_CURRENCY_WEEKLY` ✅ Free
 
```
https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_WEEKLY&symbol=BTC&market=USD&apikey=demo
```
 
---
 
### 5.5 Crypto Monthly — `DIGITAL_CURRENCY_MONTHLY` ✅ Free
 
```
https://www.alphavantage.co/query?function=DIGITAL_CURRENCY_MONTHLY&symbol=BTC&market=USD&apikey=demo
```
 
---
 
## 6. Commodities APIs
 
All commodity endpoints: required params are `function` and `apikey`. Optional: `interval` and `datatype`.
 
**interval options (where supported):** `monthly` (default), `quarterly`, `annual`
 
| Function | Commodity | Free/Premium |
|---|---|---|
| `GOLD` | Gold spot price | ✅ Free |
| `SILVER` | Silver spot price | ✅ Free |
| `WTI` | Crude Oil West Texas Intermediate | ✅ Free |
| `BRENT` | Crude Oil Brent | ✅ Free |
| `NATURAL_GAS` | Henry Hub Natural Gas | ✅ Free |
| `COPPER` | Global copper price | ✅ Free |
| `ALUMINUM` | Global aluminum price | ✅ Free |
| `WHEAT` | Global wheat price | ✅ Free |
| `CORN` | Global corn price | ✅ Free |
| `COTTON` | Global cotton price | ✅ Free |
| `SUGAR` | Global sugar price | ✅ Free |
| `COFFEE` | Global coffee price | ✅ Free |
| `ALL_COMMODITIES` | Global price index of all commodities | ✅ Free |
 
```
https://www.alphavantage.co/query?function=WTI&interval=monthly&apikey=demo
https://www.alphavantage.co/query?function=BRENT&interval=weekly&apikey=demo
https://www.alphavantage.co/query?function=GOLD&apikey=demo
```
 
---
 
## 7. Economic Indicators APIs
 
All required params: `function`, `apikey`. Optional: `interval`, `maturity`, `datatype`.
 
| Function | Indicator | interval options |
|---|---|---|
| `REAL_GDP` | US Real GDP | `annual`, `quarterly` |
| `REAL_GDP_PER_CAPITA` | US Real GDP per capita | quarterly only |
| `TREASURY_YIELD` | US Treasury yield | `daily`, `weekly`, `monthly` + `maturity` param |
| `FEDERAL_FUNDS_RATE` | Federal funds (interest) rate | `daily`, `weekly`, `monthly` |
| `CPI` | Consumer Price Index | `monthly`, `semiannual` |
| `INFLATION` | Annual US inflation rate | annual only |
| `RETAIL_SALES` | Monthly US retail sales | monthly only |
| `DURABLES` | Durable goods orders | monthly only |
| `UNEMPLOYMENT` | US unemployment rate | monthly only |
| `NONFARM_PAYROLL` | US nonfarm payroll | monthly only |
 
**`maturity` values for TREASURY_YIELD:** `3month`, `2year`, `5year`, `7year`, `10year` (default), `30year`
 
```
https://www.alphavantage.co/query?function=REAL_GDP&interval=annual&apikey=demo
https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=monthly&maturity=10year&apikey=demo
https://www.alphavantage.co/query?function=CPI&interval=monthly&apikey=demo
https://www.alphavantage.co/query?function=FEDERAL_FUNDS_RATE&interval=daily&apikey=demo
```
 
---
 
## 8. Technical Indicators APIs
 
### Universal Pattern
 
```
https://www.alphavantage.co/query?function=<INDICATOR>&symbol=<TICKER>&interval=<INTERVAL>&time_period=<N>&series_type=<TYPE>&apikey=<KEY>
```
 
### Common Params
 
| Param | Values | Notes |
|---|---|---|
| `interval` | `1min`, `5min`, `15min`, `30min`, `60min`, `daily`, `weekly`, `monthly` | Required |
| `time_period` | integer (e.g. `14`, `50`, `200`) | Number of data points used to calculate |
| `series_type` | `close`, `open`, `high`, `low` | Price series to use |
 
### Moving Averages
 
| Function | Name | Extra params |
|---|---|---|
| `SMA` | Simple Moving Average | `time_period`, `series_type` |
| `EMA` | Exponential Moving Average | `time_period`, `series_type` |
| `WMA` | Weighted Moving Average | `time_period`, `series_type` |
| `DEMA` | Double Exponential MA | `time_period`, `series_type` |
| `TEMA` | Triple Exponential MA | `time_period`, `series_type` |
| `TRIMA` | Triangular MA | `time_period`, `series_type` |
| `KAMA` | Kaufman Adaptive MA | `time_period`, `series_type` |
| `MAMA` | MESA Adaptive MA | `fastlimit`, `slowlimit` |
| `VWAP` | Volume Weighted Average Price 🔒 | intraday intervals only |
| `T3` | Triple Exponential Moving Average | `time_period`, `vfactor` |
 
```
# 50-day SMA
https://www.alphavantage.co/query?function=SMA&symbol=IBM&interval=daily&time_period=50&series_type=close&apikey=demo
 
# 20-day EMA
https://www.alphavantage.co/query?function=EMA&symbol=IBM&interval=daily&time_period=20&series_type=close&apikey=demo
```
 
---
 
### Oscillators & Momentum
 
| Function | Name | Key extra params |
|---|---|---|
| `MACD` | MACD 🔒 Premium | `fastperiod`, `slowperiod`, `signalperiod`, `series_type` |
| `MACDEXT` | MACD with controllable MA type | same + `fastmatype`, `slowmatype`, `signalmatype` |
| `RSI` | Relative Strength Index | `time_period`, `series_type` |
| `STOCH` | Stochastic | `fastkperiod`, `slowkperiod`, `slowdperiod`, `slowkmatype`, `slowdmatype` |
| `STOCHF` | Stochastic Fast | `fastkperiod`, `fastdperiod`, `fastdmatype` |
| `STOCHRSI` | Stochastic RSI | `time_period`, `fastkperiod`, `fastdperiod`, `fastdmatype`, `series_type` |
| `WILLR` | Williams %R | `time_period` |
| `ADX` | Average Directional Index | `time_period` |
| `ADXR` | ADX Rating | `time_period` |
| `APO` | Absolute Price Oscillator | `fastperiod`, `slowperiod`, `matype`, `series_type` |
| `PPO` | Percentage Price Oscillator | `fastperiod`, `slowperiod`, `matype`, `series_type` |
| `MOM` | Momentum | `time_period`, `series_type` |
| `BOP` | Balance of Power | none |
| `CCI` | Commodity Channel Index | `time_period` |
| `CMO` | Chande Momentum Oscillator | `time_period`, `series_type` |
| `ROC` | Rate of Change | `time_period`, `series_type` |
| `ROCR` | ROC Ratio | `time_period`, `series_type` |
| `AROON` | Aroon | `time_period` |
| `AROONOSC` | Aroon Oscillator | `time_period` |
| `MFI` | Money Flow Index | `time_period` |
| `TRIX` | 1-day Rate-of-Change of Triple Smooth EMA | `time_period`, `series_type` |
| `ULTOSC` | Ultimate Oscillator | `timeperiod1`, `timeperiod2`, `timeperiod3` |
| `DX` | Directional Movement Index | `time_period` |
| `MINUS_DI` | Minus Directional Indicator | `time_period` |
| `PLUS_DI` | Plus Directional Indicator | `time_period` |
| `MINUS_DM` | Minus Directional Movement | `time_period` |
| `PLUS_DM` | Plus Directional Movement | `time_period` |
 
```
# 14-day RSI
https://www.alphavantage.co/query?function=RSI&symbol=IBM&interval=daily&time_period=14&series_type=close&apikey=demo
 
# MACD (12,26,9)
https://www.alphavantage.co/query?function=MACD&symbol=IBM&interval=daily&series_type=close&apikey=demo
```
 
---
 
### Bands & Volatility
 
| Function | Name | Key extra params |
|---|---|---|
| `BBANDS` | Bollinger Bands | `time_period`, `series_type`, `nbdevup`, `nbdevdn`, `matype` |
| `MIDPOINT` | MidPoint over period | `time_period`, `series_type` |
| `MIDPRICE` | MidPoint Price over period | `time_period` |
| `SAR` | Parabolic SAR | `acceleration`, `maximum` |
| `TRANGE` | True Range | none |
| `ATR` | Average True Range | `time_period` |
| `NATR` | Normalized ATR | `time_period` |
 
```
# Bollinger Bands (20, 2)
https://www.alphavantage.co/query?function=BBANDS&symbol=IBM&interval=daily&time_period=20&series_type=close&nbdevup=2&nbdevdn=2&apikey=demo
```
 
---
 
### Volume Indicators
 
| Function | Name |
|---|---|
| `AD` | Chaikin A/D Line |
| `ADOSC` | Chaikin A/D Oscillator |
| `OBV` | On Balance Volume |
 
```
https://www.alphavantage.co/query?function=OBV&symbol=IBM&interval=daily&apikey=demo
```
 
---
 
### Hilbert Transform (Cycle Analysis)
 
| Function | Name |
|---|---|
| `HT_TRENDLINE` | Hilbert Transform Instantaneous Trendline |
| `HT_SINE` | HT Sine Wave |
| `HT_TRENDMODE` | HT Trend vs Cycle Mode |
| `HT_DCPERIOD` | HT Dominant Cycle Period |
| `HT_DCPHASE` | HT Dominant Cycle Phase |
| `HT_PHASOR` | HT Phasor Components |
 
```
https://www.alphavantage.co/query?function=HT_TRENDLINE&symbol=IBM&interval=daily&series_type=close&apikey=demo
```
 
---
 
## Code Snippets
 
### Python (requests)
 
```python
import requests
 
API_KEY = "your_api_key"
 
def get_daily_prices(symbol: str) -> dict:
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "TIME_SERIES_DAILY",
        "symbol": symbol,
        "apikey": API_KEY,
        "outputsize": "compact"
    }
    r = requests.get(url, params=params)
    r.raise_for_status()
    return r.json()
 
def get_quote(symbol: str) -> dict:
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "GLOBAL_QUOTE",
        "symbol": symbol,
        "apikey": API_KEY
    }
    r = requests.get(url, params=params)
    data = r.json()
    return data.get("Global Quote", {})
 
def get_rsi(symbol: str, period: int = 14) -> dict:
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "RSI",
        "symbol": symbol,
        "interval": "daily",
        "time_period": period,
        "series_type": "close",
        "apikey": API_KEY
    }
    r = requests.get(url, params=params)
    return r.json()
 
def get_company_overview(symbol: str) -> dict:
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "OVERVIEW",
        "symbol": symbol,
        "apikey": API_KEY
    }
    r = requests.get(url, params=params)
    return r.json()
```
 
### JavaScript / Node.js
 
```javascript
const API_KEY = "your_api_key";
const BASE_URL = "https://www.alphavantage.co/query";
 
async function getDailyPrices(symbol) {
  const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}
 
async function getQuote(symbol) {
  const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data["Global Quote"];
}
 
async function getRSI(symbol, period = 14) {
  const url = `${BASE_URL}?function=RSI&symbol=${symbol}&interval=daily&time_period=${period}&series_type=close&apikey=${API_KEY}`;
  const res = await fetch(url);
  return res.json();
}
```
 
---
 
## Rate Limits & Tiers
 
| Tier | Requests/min | Requests/day | Realtime data | Notes |
|---|---|---|---|---|
| Free | 5 | 25 | ❌ EOD only | Good for prototyping |
| Premium (entry) | 75 | 500 | ✅ | Unlocks premium endpoints |
| Premium (higher) | 150–600 | 5000+ | ✅ | Scales with plan |
 
**Free tier caveats:**
- `outputsize=full` restricted on some endpoints
- No intraday premium features
- No adjusted daily data
- Quote endpoint = end-of-day only
**Error response when rate limited:**
```json
{
  "Note": "Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute..."
}
```
 
---
 
## Common Response Patterns
 
### Time Series Response Structure
 
```json
{
  "Meta Data": {
    "1. Information": "...",
    "2. Symbol": "IBM",
    "3. Last Refreshed": "2024-01-15",
    "4. Output Size": "Compact",
    "5. Time Zone": "US/Eastern"
  },
  "Time Series (Daily)": {
    "2024-01-15": {
      "1. open": "161.50",
      "2. high": "163.20",
      "3. low": "160.80",
      "4. close": "162.75",
      "5. volume": "4521000"
    }
  }
}
```
 
### Technical Indicator Response Structure
 
```json
{
  "Meta Data": {
    "1: Symbol": "IBM",
    "2: Indicator": "Simple Moving Average (SMA)",
    "3: Last Refreshed": "2024-01-15",
    "4: Interval": "daily",
    "5: Time Period": 50,
    "6: Series Type": "close",
    "7: Time Zone": "US/Eastern"
  },
  "Technical Analysis: SMA": {
    "2024-01-15": { "SMA": "155.234" },
    "2024-01-12": { "SMA": "154.891" }
  }
}
```
 
### Error Handling
 
```python
data = r.json()
 
# Check for rate limit
if "Note" in data:
    print("Rate limited:", data["Note"])
 
# Check for invalid API key
if "Error Message" in data:
    print("API error:", data["Error Message"])
 
# Check for empty response (bad symbol)
if "Global Quote" in data and not data["Global Quote"]:
    print("Symbol not found or no data")
```
 
---
 
## Useful Links
 
- **Get free API key:** https://www.alphavantage.co/support/#api-key
- **Premium plans:** https://www.alphavantage.co/premium/
- **Full documentation:** https://www.alphavantage.co/documentation/
- **MCP server (for LLM/AI agents):** https://mcp.alphavantage.co/
- **Excel/Google Sheets add-in:** https://www.alphavantage.co/spreadsheets/
- **Community libraries (1000+ across 20+ languages):** https://github.com/search?q=alpha+vantage
- **Realtime data policy:** https://www.alphavantage.co/realtime_data_policy/