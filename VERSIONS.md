# OptionFlow — Version History

> **Branch rules:** All development happens on `develop` (or `feat/*` branches off `develop`).  
> `main` is production-only and is **never touched directly**. Releases happen on explicit approval.

---

## v1.1.0 — TradingView Chart + Search Page Overhaul
**Released:** 2025-02-25  
**Commit:** `c60cfbc`  
**Tag:** `v1.1.0`  
**Branch:** `main` (production)

### ✨ New Features
- **TradingView-style interactive chart** (`web/components/chart/TradingChart.tsx`)
  - Built on `lightweight-charts v5.1.0` — professional-grade financial charting
  - **Candlestick / Line** toggle for price display mode
  - **Volume histogram** rendered on a separate price scale below the main chart
  - **SMA overlays** — 20, 50, and 200-day moving averages, independently toggleable
  - **Period selector** — 1D · 5D · 1M · 3M · 6M · 1Y · 5Y (fetches correct OHLCV window per selection)
  - **Earnings marker** — triangular `▲` marker rendered directly on the date of the next earnings event
  - **GEX price lines** — horizontal lines for Call Wall (green), Put Wall (red), and Zero Gamma (amber), sourced from live GEX calculation
  - **OHLCV crosshair legend** — floating O/H/L/C/V values update in real-time as the cursor moves
  - **ResizeObserver** — chart reflows cleanly when the panel or viewport is resized
  - **Dark mode aware** — chart background and grid match the app's neutral dark theme
- **Earnings banner** on the Overview tab — amber callout showing "Next Earnings: [date] · in N days"

### 🎨 Design
- **Full neutral retheme of the stock search page** (`web/app/(app)/search/page.tsx`)
  - All purple/violet accent colors removed; replaced with `var(--foreground)` neutral system
  - All tabs, buttons, badges, section headers, and flow momentum indicators rethemed
  - Consistent with the v1.0.0 app-wide neutral palette

### 🐛 Bug Fixes
- `gexLevels` null → undefined coercion (`?? undefined`) to fix TypeScript strict null check
- `UTCTimestamp` branded type from `lightweight-charts` — fixed with `import type { UTCTimestamp }` and `as unknown as UTCTimestamp` cast
- Stale Node.js process on port 3000 causing Internal Server Error on `/search` — documented and resolved

### 🔧 Internal
- Removed unused `useRef`, `QuoteBar`, `LineChart`, `PERIOD_CFG`, `PriceTooltip` from search page after chart refactor
- `PriceChartPanel` is now a thin wrapper that delegates to `TradingChart` — keeps backward-compatible prop API

---

## v1.0.0 — Stable Foundation
**Released:** 2025-02-25  
**Commit:** `c5aee82`  
**Tag:** `v1.0.0`  
**Branch:** `main`

### ✨ New Features
- **GEX formula corrected to canonical standard** (SpotGamma / Perfiliev)
  - Full formula: `gamma × OI × lot_size × spot² × 0.01`
  - Sign convention: calls = positive GEX, puts = negative GEX (dealer perspective)
  - Time parameter: `T = max(T_days, 1) / 252.0` (trading days, not calendar)
  - Previous implementation was missing the `spot² × 0.01` scaling factor and had inverted put sign
- **King node fixed** in GEX Strike Table
  - Star glyph now renders in amber (`#f59e0b`) — was previously invisible black-on-dark
  - King is now computed from visible/displayed strikes only (not the full dataset)
  - `kingMap` computed with `useMemo` to avoid redundant recalculation
  - Fixed duplicate `const isKing` declaration that caused a build error

### 🎨 Design
- **App-wide neutral retheme** — all purple, violet, and blue gradient accents removed
- Design tokens use `var(--foreground)` / `var(--background)` throughout
- **Mobile responsiveness** — fixed horizontal overflow (`overflow-x: hidden`), corrected `viewport` meta tag
- Navbar logout button now correctly redirects to `/` instead of `/login`
- Auth guard redirects unauthenticated users to `/` (landing page) instead of `/login`

### 🐛 Bug Fixes
- GEX heatmap `[si][ei]` axis order corrected to `[ei][si]`
- King star size increased and color fixed for visibility across all heatmap cell backgrounds

---

## v1-streamlit-final — Legacy (Streamlit Era)
**Commit:** `910c5a2`  
**Tag:** `v1-streamlit-final`

The last stable state of the Streamlit-based OptionFlow app before the full React/Next.js migration. Retained as a historical reference point. Not production-deployable in the current infrastructure.

---

## Versioning Convention

| Version | Meaning |
|---|---|
| `vX.0.0` | Major milestone — significant architecture or product change |
| `vX.Y.0` | Minor release — new features shipped to production |
| `vX.Y.Z` | Patch release — bug fixes only, no new features |
| `vX.Y.Z-rc1` | Release candidate — staging/testing only, not production |

## Branch Workflow

```
feat/your-feature  →  develop  →  (release approval)  →  main
                                                              ↓
                                                         git tag vX.Y.Z
```

- **`feat/*`** — All new features and non-trivial fixes
- **`develop`** — Integration branch; staging state
- **`main`** — Production only; never committed to directly
- Tags are applied to `main` commits only, after explicit release approval
