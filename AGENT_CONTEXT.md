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
| `trades.db` | Trade journal | `trades`, `orders`, `order_events`, `accounts` |
| `portfolio.db` | Holdings & options | `stock_holdings`, `option_positions`, `weekly_snapshots`, `premium_ledger`, `portfolio_value_history` |
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
  main.py          # thin app factory — CORS, middleware, lifespan, health
  state.py         # shared GEX cache, background poller, flow-DB helpers
  utils.py         # df_records() — single canonical dict serialiser
  deps.py          # FastAPI Depends: get_current_user, require_admin
  schemas.py       # All Pydantic v2 request/response models
  routers/
    auth.py        # /auth/* — login, refresh, sessions, change-password
    trades.py      # /trades, /orders, /accounts
    portfolio.py   # /portfolio/weeks, /portfolio/positions, /portfolio/summary
    budget.py      # /budget, /cash, /credit-card-weeks, /budget/ledger/*
    markets.py     # /search, /stock/info, /market/quotes, /options/gamma-exposure/*
    admin.py       # /admin/users
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

# All tests should pass: currently 448 passing, 0 failing
```

**Conftest pattern:** `tests/conftest.py` provides `db_engine_and_session` fixture.
- Creates a single `StaticPool` in-memory SQLite engine
- Creates all tables from all 5 Bases
- Monkeypatches all `get_*_engine` and `get_*_session` on both `database.models` and `logic.services`

---

## Version History (summary)

| Version | What |
|---------|------|
| v2.3.0 | 8 backend improvements: DB session bugs fixed, SQL pagination, async yfinance routes, typed Pydantic schemas for all portfolio routes, GET /trades/{id}, GET+POST /portfolio/value-history, new services (list_trades, get_trade, list_cash_flows, list_budget_entries, list_portfolio_snapshots, upsert_portfolio_snapshot) |
| v2.2.0 | 448 passing tests, lifespan migration, /health DB ping, field-name fixes |
| v2.1.0 | 18 audit fixes: state.py/utils.py, TTLCache, pagination, model_validate |
| v2.0.0 | Split 1735-line main.py into 6 routers |
| v1.9.1 | Automated DB backups (cron + retention) |
| v1.9.0 | Split monolithic DB into 5 domain DBs |
| v1.8.4 | Migration from V1 to OptionFlow_main |

See `VERSIONS.md` for full changelog.

---

## What Needs to Be Built Next

These are the highest-impact features in priority order:

### 🥇 1. Trade Entry UI
- `trades.db` is empty — no trades entered yet
- Need a clean **Add Trade** form: symbol, BUY/SELL, qty, price, date, notes, optional option fields
- CSV import from broker statements would be very valuable
- All trades go to `POST /trades` → `trades.db`

### 🥈 2. Stock Holdings → Portfolio page
- `/trades` page (Options Flow portfolio) needs holdings to show covered call opportunities
- Flow: Add stock holding (symbol, shares, cost basis) → app shows current covered call strikes
- Goes to `portfolio.db` (`stock_holdings` table)

### 🥉 3. Portfolio Value History chart
- `GET /portfolio/value-history` and `POST /portfolio/value-history` endpoints are live (v2.3.0)
- `portfolio_value_history` table exists but is empty — need UI to enter weekly net-worth snapshots
- Dashboard should render a line chart of this over time (connect to the new endpoints)

### 4. Budget — complete CC week flow
- Credit card week tracker exists (1 row) but needs a proper "settle up" weekly flow
- Enter card spend for the week → mark as paid

### 5. Alembic multi-DB migrations
- alembic/env.py is fixed to support all 5 DBs via `ALEMBIC_DB=users|trades|portfolio|budget|markets`
- No migration files have been created yet for the new schema
- Run `alembic revision --autogenerate -m "description"` per DB to generate them

### 6. Split `logic/services.py` (2295 lines)
- The last single large file
- Split into: `logic/auth.py`, `logic/trades.py`, `logic/budget.py`, `logic/portfolio_services.py`

---

## Known Issues / Gotchas

1. **`StockHolding` uses `shares` + `cost_basis`** — not `quantity`. Any new code must use the correct field names.
2. **Trades page is the weekly options portfolio** — NOT a raw trade journal. The raw trade journal (buy/sell history) lives on the Dashboard.
3. **Node.js** is at a custom path: `/Users/karthikkondajjividyaranya/bin/node-v20.11.1-darwin-arm64/bin/`. Always set `PATH` before running npm/node commands.
4. **`.next` cache corruption** — if the frontend returns 500, `rm -rf web/.next` and restart.
5. **Zoom locked on iOS/iPadOS** — `maximumScale=1, userScalable=no` is intentional (app-like feel).

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
