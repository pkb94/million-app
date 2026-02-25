# OptionFlow V1

Full-stack trading analytics platform — options flow (GEX), sector heatmaps, trade journaling, order management, and portfolio tracking.

## Stack

- **Backend**: FastAPI (Python 3.12) + SQLite via SQLAlchemy + Alembic migrations
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + TypeScript
- **Auth**: JWT with refresh token rotation, PBKDF2 password hashing

## Project Structure

```
OptionFlow_V1/
├── backend_api/        # FastAPI app (main.py, schemas.py, security.py)
├── database/           # SQLAlchemy models
├── logic/              # Business logic (gamma.py, services.py)
├── brokers/            # Paper broker / order execution adapters
├── alembic/            # DB migration scripts
├── scripts/            # Utility scripts (create_user.py, dev.sh)
├── tests/              # pytest test suite (33 tests)
├── web/                # Next.js frontend
│   ├── app/(app)/      # Authenticated pages (dashboard, options-flow, search, trades, …)
│   ├── components/     # Reusable React components
│   └── lib/            # Shared utilities (gex.ts, api.ts, …)
└── trading_journal.db  # SQLite database (local)
```

## Quick Start (Local)

### 1. Backend (FastAPI)

```bash
cd OptionFlow_V1
pip install -r requirements.txt   # use Python 3.12+

# Start the API
PYTHONPATH=$PWD python -m uvicorn backend_api.main:app \
  --host 127.0.0.1 --port 8000
```

### 2. Frontend (Next.js)

```bash
cd web
npm install
BACKEND_URL=http://127.0.0.1:8000 npx next dev -p 3000
```

App available at **http://localhost:3000**

### 3. Run Tests

```bash
PYTHONPATH=. pytest tests/ -q
```

## Default Credentials

| Username      | Password    |
|---------------|-------------|
| demo          | demo123     |
| karthik.kv12  | karthik123  |

## Database Migrations

```bash
alembic upgrade head
```

## Environment Variables

| Variable     | Default                     | Description                  |
|--------------|-----------------------------|------------------------------|
| JWT_SECRET   | dev-secret (change in prod) | JWT signing key               |
| DATABASE_URL | sqlite:///trading_journal.db | SQLAlchemy database URL      |
| BACKEND_URL  | http://127.0.0.1:8000       | Next.js → API proxy target   |
