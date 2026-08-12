# Stock Market

Each country has a **stock exchange** hub listing corporations, bonds, commodities, wealth rankings, and market statistics.

## Routes

- **Global** — `/stockmarket/global` — all listed corporations worldwide (exchange filter).
- **Country exchange hubs** — `/country/[code]/stockmarket` for each configured exchange country.
- **Legacy country URLs** — `/stockmarket/[country]` redirects to `/country/[code]/stockmarket`; `/stockmarket/global` remains the global view.

Active exchanges are config-driven from `COUNTRY_CONFIGS.exchangeName`: **NYSE** (US), **FTSE** (UK), **DAX** (DE), and **Nikkei** (JP).

## Tabs (URL `tab=`)

Tab order: **Stocks** (`stocks`), **Bonds** (`bonds`), **Commodities** (`commodities`), **Forex** (`forex`), **Wealth List** (`wealth`), **Stats** (`stats`). Legacy `?tab=listings` is accepted and treated as **Stocks**. The active tab persists in the query string so browser back/forward and shared links work correctly.

Pages typically include **market cap**, **share price**, revenue and income snapshots, CEO pointers, **sector type**, and **headquarters** location. Stock price history is displayed as **OHLC candlestick charts** showing open, high, low, and close prices per period with high data density. A **Corporate / Sovereign toggle** splits the bond table; sovereign bonds display the issuing country's flag as their logo.

The **Stats** tab summarizes equity by sector (from the current listing set), a **market-cap-by-sector pie**, **per-sector bar charts** driven by one global metric control (revenue, profit, market cap, share price, dividend rate—with mcap-weighted average dividend per sector when that metric is selected), **largest companies by sector** cards (linked to corporate pages; colors use `brandColor` or a deterministic fallback), historical **global** sector market-cap lines (from `marketCapHistory`), and compact bond and commodity snapshots. Listings from `GET /api/stock-exchange` include `brandColor` and `dividendRate` for those visuals.

## How it connects to other systems

- **Shares** — Buy/sell and limit orders are driven from corporate pages; prices blend trading, balance sheet, and earnings (see [[Corporations]]).
- **Bonds** — Corporate bonds link to issuer credit; sovereign bonds link to national finance ([[Sovereign Bonds]], [[National Budget & Treasury]]).
- **Commodities** — Summary and deep links into `/commodity/[type]` ([[Commodities]]).
- **Forex** — Exchange-rate table and order-book summary from `/api/forex/exchange`, with deep links into `/country/[code]/forex/[currency]` ([[Currency Exchange & Multi-Currency System]]).

## Discord Integration

- `GET /api/discord-bot/stock-chart` — Returns corporation price history chart data. Defaults to market-wide data with optional corporation and country filters. Pre-computed snapshots at turn time eliminate expensive on-demand aggregation.

## Related pages

- [[Corporations]] — Founding, sectors, shares, CEO, corporate bonds
- [[Commodities]] — Supply, demand, and pricing
- [[Sovereign Bonds]] — Government debt listings
- [[National Budget & Treasury]] — Treasury context
