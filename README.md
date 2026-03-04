# OptionFlow

Full-stack trading analytics platform — options flow (GEX), sector heatmaps, trade journaling, order management, portfolio tracking, and budget management.

## Stack

- **Backend**: FastAPI (Python 3.13) + SQLite via SQLAlchemy + Alembic migrations
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + TypeScript
- **Auth**: JWT with refresh token rotation, PBKDF2 password hashing

## Project Structure

```
OptionFlow_main/
├── backend_api/        # FastAPI app (main.py, schemas.py, security.py)
├── database/           # SQLAlchemy models (5-DB architecture)
├── logic/              # Business logic (gamma.py, services.py, portfolio.py, holdings.py)
├── brokers/            # Paper broker / order execution adapters
├── alembic/            # DB migration scripts
├── scripts/            # Utility scripts (create_user.py, backup_dbs.py)
├── tests/              # pytest test suite
├── backups/            # Auto-generated DB snapshots (gitignored)
├── web/                # Next.js frontend
│   ├── app/(app)/      # Authenticated pages (dashboard, options-flow, trades, budget, markets, …)
│   ├── components/     # Reusable React components
│   └── lib/            # Shared utilities (api.ts, auth.tsx, …)
├── users.db            # Auth: users, refresh tokens, auth events
├── trades.db           # Trades: trades, orders, accounts
├── portfolio.db        # Portfolio: holdings, positions, weekly snapshots, premium ledger
├── budget.db           # Budget: entries, overrides, CC weeks, cash flow, ledger
└── markets.db          # Markets: GEX snapshots, price snapshots
```

## Quick Start (Local)

### 1. Backend (FastAPI)

```bash
cd /path/to/OptionFlow_main
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

uvicorn backend_api.main:app --reload --port 8000
```

✅ Verify: `curl http://localhost:8000/health` → `{"status":"ok"}`

### 2. Frontend (Next.js)

```bash
export PATH="/Users/karthikkondajjividyaranya/bin/node-v20.11.1-darwin-arm64/bin:$PATH"
cd web
npm install
node node_modules/.bin/next dev --port 3000
```

App available at **http://localhost:3000**

### 3. Run Tests

```bash
source .venv/bin/activate
PYTHONPATH=. pytest tests/ -q
```

## Credentials

| Username      | Password         | Role  |
|---------------|------------------|-------|
| karthik.kv12  | Karthik@123456   | admin |

## Database Architecture

The app uses **5 separate SQLite databases**, one per domain:

| File | Contents |
|---|---|
| `users.db` | User accounts, refresh tokens, auth events |
| `trades.db` | Trades, orders, order events, brokerage accounts |
| `portfolio.db` | Stock holdings, option positions, weekly snapshots, premium ledger |
| `budget.db` | Budget entries, overrides, credit card weeks, cash flow, ledger |
| `markets.db` | GEX/net flow snapshots, price snapshots |

To migrate from a legacy monolithic DB:
```bash
python3 scripts/migrate_to_split_dbs.py
```

## Automated Backups

All 5 databases are backed up automatically via cron every night at midnight:
```bash
python3 scripts/backup_dbs.py
```
Backups are stored in `backups/` with daily (7), weekly (4), and monthly (12) retention.

## Database Migrations (Alembic)

```bash
alembic upgrade head
```

## Environment Variables

| Variable              | Default                       | Description                        |
|-----------------------|-------------------------------|------------------------------------|
| `JWT_SECRET`          | dev-secret (change in prod)   | JWT signing key                    |
| `DATABASE_URL_USERS`  | `sqlite:///./users.db`        | Users database                     |
| `DATABASE_URL_TRADES` | `sqlite:///./trades.db`       | Trades database                    |
| `DATABASE_URL_PORTFOLIO` | `sqlite:///./portfolio.db` | Portfolio database                 |
| `DATABASE_URL_BUDGET` | `sqlite:///./budget.db`       | Budget database                    |
| `DATABASE_URL_MARKETS`| `sqlite:///./markets.db`      | Markets database                   |
| `BACKEND_URL`         | `http://localhost:8000`       | Next.js → API proxy target         |

## Branch Strategy

| Branch | Purpose |
|---|---|
| `develop` | ✅ Active development — all new work goes here |
| `main` | Production-ready releases only — never commit directly |
