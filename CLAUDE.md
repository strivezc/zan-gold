# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ZAN GOLD (金攒攒)** — a WeChat Mini Program for precious metals investment management. Tracks real-time gold (XAU), silver (XAG), platinum (XPT), palladium (XPD) prices with multi-position portfolio management, transaction history, price alerts, and cloud sync.

## Development Commands

**Mini Program:** Open in WeChat DevTools (微信开发者工具). No CLI build — IDE-driven development with hot reload.

**Price Alert Script (legacy):**
```bash
npm install && cp .env.example .env  # Configure credentials
node scripts/price-alert.js          # Run standalone email alert service
```

No test framework or linter configured.

## Architecture

**4-tab WeChat Mini Program** with custom tabBar, 8 utility modules, 1 Canvas component, and 2 cloud functions.

### Page Structure

| Tab | Page | Purpose |
|-----|------|---------|
| 行情 | `pages/market/` | Price display, gold-silver ratio, price chart, converter |
| 持仓 | `pages/portfolio/` | Multi-position management, buy/sell, P/L, screenshot share |
| 历史 | `pages/history/` | Transaction log, realized P/L summary, filters |
| 设置 | `pages/settings/` | Theme, price alerts, data management, about |

### Data Flow

1. `utils/goldService.js` — Fetches XAU/XAG/XPT/XPD prices + USD/CNY rate in parallel via `api.gold-api.com` and `open.er-api.com`. Calculates gold-silver ratio.
2. `pages/market/market.js` — Calls `fetchLivePrices()` every 30s. Records price snapshots via `priceHistory.js`. Checks price alerts via `alertService.js`. Shares prices to `app.globalData.prices`.
3. `utils/storage.js` — Single source of truth for all data persistence (positions, transactions, alerts, settings). Debounced cloud sync on every write.
4. `utils/calculator.js` — Pure functions: weighted average cost, unrealized P/L, portfolio summary.
5. `utils/transactionService.js` — Buy/sell with FIFO cost matching for realized P/L.
6. `utils/cloudService.js` — WeChat Cloud Development sync with id-based merge conflict resolution.

### Key Data Models

**Position:** `{ id, metal, date, pricePerGram, weight, note, createdAt }`
**Transaction:** `{ id, type:"buy"|"sell", metal, date, pricePerGram, weight, realizedPnl, costBasis, createdAt }`
**Alert:** `{ id, metal, condition:"above"|"below", targetPrice, enabled, lastTriggeredAt, createdAt }`

### CSS Theming

All styles use CSS custom properties defined in `app.wxss`. Dark mode via `page.dark` class override. Key variables: `--bg-color`, `--card-white`, `--text-main`, `--text-sub`, `--gold-gradient`, `--silver-gradient`, `--color-up` (red), `--color-down` (green).

## Key Files

| File | Role |
|---|---|
| `app.js` | Entry point: data migration, theme init, cloud init, sync orchestration |
| `app.json` | 4-tab tabBar config (custom), page routes, window settings |
| `app.wxss` | Global CSS variables + dark mode overrides |
| `custom-tab-bar/` | Custom tabBar component (Apple-style with gold indicator) |
| `pages/market/` | Price display, gold-silver ratio, Canvas price chart, converter |
| `pages/portfolio/` | Multi-position CRUD, buy/sell with FIFO, screenshot sharing |
| `pages/history/` | Transaction log with filters, realized P/L summary |
| `pages/settings/` | Theme picker, price alert management, data cleanup |
| `components/price-chart/` | Canvas 2D chart component (day/week/month, touch crosshair) |
| `utils/goldService.js` | API layer for 4 metals + exchange rate |
| `utils/storage.js` | Data persistence + cloud sync hooks |
| `utils/calculator.js` | Pure portfolio calculations |
| `utils/transactionService.js` | Buy/sell logic with FIFO matching |
| `utils/priceHistory.js` | Price snapshot recording + 3-tier aggregation |
| `utils/alertService.js` | Alert checking + notification dispatch |
| `utils/cloudService.js` | Cloud sync with conflict resolution |
| `utils/screenshotService.js` | Offscreen Canvas portfolio card generation |
| `utils/formatter.js` | Display formatting + number animation |
| `cloudfunctions/getOpenId/` | Cloud function: get user openId |
| `cloudfunctions/sendAlert/` | Cloud function: send subscription message |
| `scripts/price-alert.js` | Legacy standalone Node.js email alert (cron) |

## Conventions

- All code comments and UI text are in Chinese.
- ES6 modules (`import`/`export`) in mini program pages; CommonJS (`require`) in utils.
- Price formula: `(usdPerOz / 31.1035) * usdCnyRate` → CNY/gram.
- Red (`#ff3b30`) = up, Green (`#34c759`) = down (Chinese market convention).
- All `rpx` units for responsive sizing.
- The `.env` file contains real credentials — do not commit it.
- Cloud environment must be configured in WeChat DevTools (env: `zan-gold-prod`).
