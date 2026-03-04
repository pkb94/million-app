# AGENT_CONTEXT.md — Read this first before doing anything

This file is for any new AI agent/chat session working on this codebase.
It summarises the current state, architecture decisions, workflow rules, and what to do next.

---

## Project

**OptionFlow** — Personal finance + options trading portfolio tracker.
- Owner: Karthik Kondajji Vidyaranya (`Karthikkv12`)
- GitHub repo: `Karthikkv12/million-app`
- Stack: FastAPI (Python 3.11) backend · Next.js 14 (TypeScript) frontend · SQLite (5 DBs)

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `develop` | ✅ **Always work here** — ALL code changes go to `develop` |
| `main` | Production only — merge from `develop` when ready to release |

> **Never commit directly to `main`.** Always work on `develop`, then push to `develop`.
> Merge to `main` only when the user explicitly says "push to main" or "release".

---

## How to Start the App

### Backend
```bash
cd /Users/karthikkondajjividyaranya/Desktop/OptionFlow_main
source .venv/bin/activate
uvicorn backend_api.main:app --reload --port 8000
```

### Frontend
```bash
export PATH="/Users/karthikkondajjividyaranya/bin/node-v20.11.1-darwin-arm64/bin:$PATH"
cd /Users/karthikkondajjividyaranya/Desktop/OptionFlow_main/web
node node_modules/.bin/next dev --port 3000
```

### Auto-start (launchd — survives reboots)
Three launchd agents are installed and active:
- `com.optflw.fastapi` → backend on :8000
- `com.optflw.nextjs` → frontend on :3000
- `com.optflw.cloudflared` → optflw.com tunnel

To restart: `launchctl unload ~/Library/LaunchAgents/com.optflw.X.plist && launchctl load ~/Library/LaunchAgents/com.optflw.X.plist`

---

## Credentials

| Field | Value |
|-------|-------|
| Username | `karthik.kv12` |
| Password | `Karthik@123456` |
| Role | `admin` |

---

## Database Architecture (5 separate SQLite files)

| File | Domain | Key tables |
|------|--------|-----------|
| `users.db` | Auth & users | `users`, `refresh_tokens`, `revoked_tokens`, `auth_events` |
| `trades.db` | Accounts & holdings | `accounts`, `stock_holdings` |
| `portfolio.db` | Options portfolio | `option_positions`, `weekly_option_portfolio`, `premium_ledger`, `portfolio_value_history` |
| `budget.db` | Personal finance | `budget`, `budget_overrides`, `credit_card_weeks`, `cash_flow`, `ledger_*` |
| `markets.db` | Market data | `net_flow_snapshots`, `price_snapshots` |

All DB files live at `/Users/karthikkondajjividyaranya/Desktop/OptionFlow_main/*.db`.

> **Do not use the old `trading_journal.db` for anything.** It is the legacy monolithic DB; all data has been migrated.

### Session factories (use these in all new code)
```python
from database.models import (
    get_users_session, get_trades_session,
    get_portfolio_session, get_budget_session, get_markets_session,
)
# OR the engine getters:
# get_users_engine(), get_trades_engine(), get_portfolio_engine(),
# get_budget_engine(), get_markets_engine()
```

---

## Backend Architecture (`backend_api/`)

```
backend_api/
  main.py          # thin app factory — CORS, middleware, lifespan, health, /health (all 5 DBs)
  state.py         # shared GEX cache, background poller, flow-DB helpers
  utils.py         # df_records() — single canonical dict serialiser
  deps.py          # FastAPI Depends: get_current_user, require_admin
  schemas/         # Pydantic v2 models — split by domain
    __init__.py    # re-exports everything (backward compat)
    auth.py        # auth schemas
    trades.py      # account + holding schemas
    budget.py      # cash, budget, CC week schemas
    portfolio.py   # option position, weekly portfolio, snapshot schemas
  routers/
    auth.py        # /auth/* — login, refresh, sessions, change-password
    trades.py      # /accounts, /holdings  (raw trade journal removed)
    portfolio.py   # /portfolio/weeks, /portfolio/positions, /portfolio/summary
    budget.py      # /budget, /cash, /credit-card-weeks, /budget/ledger/*
    markets.py     # /stock/info, /market/quotes, /options/gamma-exposure/*
    admin.py       # /admin/users
```

**logic/ service layer (split from monolith):**
```
logic/
  auth_services.py      # auth, users, tokens, rate-limiting
  trade_services.py     # accounts, holdings (no raw trade journal)
  budget_services.py    # cash, budget, overrides, CC weeks, ledger
  portfolio_services.py # portfolio value history snapshots
  portfolio.py          # option positions, weekly portfolio, premium ledger
  holdings.py           # stock holding helpers
  gamma.py              # GEX calculations (core product)
  services.py           # thin re-export shim (backward compat)
  premium_ledger.py     # premium ledger helpers
```

**Rules:**
- Every new route goes in the correct router file, NOT in main.py
- Use `df_records()` from `backend_api.utils` — never duplicate it
- Always use `logger = logging.getLogger("optionflow.<module>")` — no `print()` for errors
- Response models: always declare `response_model=` on every route
- Use `model_validate(dict)` (Pydantic v2) not manual `Foo(field=dict["field"], ...)`
- Pagination: all list endpoints must support `limit: int = Query(50, ge=1, le=1000)` and `offset: int = Query(0, ge=0)`

---

## Frontend Architecture (`web/`)

```
web/app/(app)/
  dashboard/     # Portfolio overview + recent trades
  options-flow/  # GEX + net flow charts
  markets/       # Stock quotes + search
  trades/        # Weekly options portfolio (covered calls, positions, holdings)
  budget/        # Budget tracker + credit card weeks
  settings/      # User settings
web/components/
  Navbar.tsx     # Desktop sidebar — Dashboard → Options Flow → Markets → Trades → Budget
  BottomNav.tsx  # Mobile nav — same order
web/lib/
  api.ts         # All fetch calls to the backend
  auth.tsx       # Auth context — silent refresh on load, proactive refresh timer
```

**Navigation order (must be consistent):**
Dashboard → Options Flow → Markets → Trades → Budget

---

## Automated Backups

Daily cron at midnight backs up all 6 DB files to `OptionFlow_main/backups/`.
- Retention: 7 daily, 4 weekly, 12 monthly
- Script: `scripts/backup_dbs.py`
- Log: `/tmp/optionflow_backup.log`
- `backups/` is in `.gitignore` — never committed

---

## Testing

```bash
# Run all tests (except GEX integration test)
source .venv/bin/activate && python -m pytest tests/ -q --ignore=tests/test_api_gex.py

# All tests should pass: currently 428 passing, 0 failing
```

**Conftest pattern:** `tests/conftest.py` provides `db_engine_and_session` fixture.
- Creates a single `StaticPool` in-memory SQLite engine
- Creates all tables from all 5 Bases
- Monkeypatches all `get_*_engine` and `get_*_session` on both `database.models` and `logic.services`

---

## Version History (summary)

| Version | What |
|---------|------|
| v2.4.0 | Removed broker layer, order system, raw trade journal, dead frontend pages (orders/accounts/search/stocks). 428 passing tests. |
| v2.3.1 | Split schemas.py into domain package (auth/trades/budget/portfolio). Fixed npm PATH in dev.sh. |
| v2.3.0 | Split services.py monolith into auth_services, trade_services, budget_services, portfolio_services. /health probes all 5 DBs. Backend API improvements (GET /trades filters, PATCH/DELETE /cash, GET /budget/summary, enum validation). |
| v2.2.0 | 448 passing tests, lifespan migration, /health DB ping, field-name fixes |
| v2.1.0 | 18 audit fixes: state.py/utils.py, TTLCache, pagination, model_validate |
| v2.0.0 | Split 1735-line main.py into 6 routers |
| v1.9.0 | Split monolithic DB into 5 domain DBs |

See `VERSIONS.md` for full changelog.

---

## What Needs to Be Built Next

These are the highest-impact features in priority order:

### 🥇 1. Portfolio Value History chart
- `GET /portfolio/value-history` and `POST /portfolio/value-history` endpoints are live
- `portfolio_value_history` table exists but is empty — need UI to enter weekly net-worth snapshots
- Dashboard should render a line chart of this over time

### 🥈 2. Budget — complete CC week flow
- Credit card week tracker exists but needs a proper "settle up" weekly flow
- Enter card spend for the week → mark as paid

### 🥉 3. GEX caching / faster Options Flow load
- yfinance fetch is slow (~3–8s) on first load
- Consider persisting last GEX result to markets.db so the page loads from cache instantly
- Background refresh every N minutes via the existing poller in state.py

### 4. Alembic multi-DB migrations
- alembic/env.py supports all 5 DBs via `ALEMBIC_DB=users|trades|portfolio|budget|markets`
- No autogenerated migration files yet — run per-DB to capture current schema

---

## Known Issues / Gotchas

1. **`StockHolding` uses `shares` + `cost_basis`** — not `quantity`. Any new code must use the correct field names.
2. **Trades page is the weekly options portfolio** — covered calls, CSPs, option positions. There is NO raw trade journal — it was removed in v2.4.0.
3. **Node.js** is at a custom path: `/Users/karthikkondajjividyaranya/bin/node-v20.11.1-darwin-arm64/bin/`. Always set `PATH` before running npm/node commands.
4. **`.next` cache corruption** — if the frontend returns 500, `rm -rf web/.next` and restart.
5. **Zoom locked on iOS/iPadOS** — `maximumScale=1, userScalable=no` is intentional (app-like feel).
6. **schemas is a package, not a file** — `backend_api/schemas/` is a directory with `__init__.py`. Import from `backend_api.schemas` as before; do NOT create a new `schemas.py` file.
7. **brokers/ folder is gone** — broker abstraction and order system removed in v2.4.0. Do not re-add.

---

## Key Commands Reference

```bash
# Check backend health
curl -s http://localhost:8000/health

# Login and test an endpoint
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"karthik.kv12","password":"Karthik@123456"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:8000/budget -H "Authorization: Bearer $TOKEN"

# Run tests
source .venv/bin/activate && python -m pytest tests/ -q --ignore=tests/test_api_gex.py

# DB row counts
source .venv/bin/activate && python3 -c "
import sqlite3
for db in ['users.db','trades.db','portfolio.db','budget.db','markets.db']:
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    cur.execute(\"SELECT name FROM sqlite_master WHERE type='table'\")
    for (t,) in cur.fetchall():
        cur.execute(f'SELECT COUNT(*) FROM {t}')
        print(f'{db}.{t}: {cur.fetchone()[0]}')
    conn.close()
"

# Git workflow
git checkout develop           # always work here
git add -A
git commit -m "feat/fix: ..."
git push origin develop
# When releasing:
git checkout main && git merge develop && git push origin main && git checkout develop
```
