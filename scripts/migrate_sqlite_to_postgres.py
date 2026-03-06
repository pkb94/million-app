"""One-shot helper to migrate all five OptionFlow SQLite databases to PostgreSQL.

The script reads every table from each SQLite file and writes the rows into the
matching Postgres schema (auth / trades / portfolio / budget / markets) on the
target instance.

Usage:
    python3 scripts/migrate_sqlite_to_postgres.py \\
        --pg "postgresql://user:pass@host:5432/optionflow"

Options:
    --pg      Postgres connection URL (required)
    --db-dir  Directory containing the .db files (default: repo root)
    --domain  Migrate only one domain: users|trades|portfolio|budget|markets
    --dry-run Print row counts without writing to Postgres
    --truncate Truncate target tables before inserting (idempotent re-runs)

Prerequisites:
    1. The target Postgres database must already exist.
    2. Run Alembic migrations first so all schemas and tables exist:
           export DATABASE_URL=<pg-url>
           for db in users trades portfolio budget markets; do
               ALEMBIC_DB=$db alembic upgrade head
           done
    3. This script runs AFTER migrations — it only copies data, never creates tables.

Safety:
    - Always run --dry-run first to verify row counts.
    - Run against a staging copy before touching production.
    - Foreign key constraints on Postgres may need to be deferred; the script
      disables FK checks per session to allow any insertion order.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
import sqlalchemy
from sqlalchemy import text


# ── Domain map: sqlite filename → (pg_schema, [table_names]) ─────────────────
# Table names must match the SQLAlchemy models exactly.
DOMAIN_MAP: dict[str, tuple[str, list[str]]] = {
    "users": (
        "auth",
        ["users", "refresh_tokens", "revoked_tokens", "auth_events"],
    ),
    "trades": (
        "trades",
        ["accounts"],
    ),
    "portfolio": (
        "portfolio",
        [
            "stock_holdings",
            "holding_events",
            "weekly_snapshots",
            "option_positions",
            "premium_ledger",
            "stock_assignments",
            "portfolio_value_history",
        ],
    ),
    "budget": (
        "budget",
        [
            "budget",
            "budget_overrides",
            "credit_card_weeks",
            "cash_flow",
            "ledger_accounts",
            "ledger_entries",
            "ledger_lines",
        ],
    ),
    "markets": (
        "markets",
        ["net_flow_snapshots", "price_snapshots"],
    ),
}


def migrate_domain(
    domain: str,
    db_dir: Path,
    pg_eng: sqlalchemy.engine.Engine,
    *,
    dry_run: bool,
    truncate: bool,
) -> None:
    schema, tables = DOMAIN_MAP[domain]
    sqlite_path = db_dir / f"{domain}.db"
    # users domain SQLite file is called users.db but also check legacy name
    if domain == "users" and not sqlite_path.exists():
        sqlite_path = db_dir / "users.db"

    if not sqlite_path.exists():
        print(f"  [SKIP] {sqlite_path} not found")
        return

    sqlite_eng = sqlalchemy.create_engine(f"sqlite:///{sqlite_path}")

    for table in tables:
        try:
            df = pd.read_sql_table(table, sqlite_eng)
        except Exception as exc:
            print(f"  [SKIP] {domain}.{table}: {exc}")
            continue

        if df.empty:
            print(f"  [EMPTY] {schema}.{table} — 0 rows, skipping")
            continue

        print(f"  {'[DRY-RUN] ' if dry_run else ''}→ {schema}.{table}: {len(df)} rows")

        if dry_run:
            continue

        with pg_eng.begin() as conn:
            # Disable FK checks for this session to allow any insertion order
            conn.execute(text("SET session_replication_role = replica"))

            if truncate:
                conn.execute(text(f'TRUNCATE TABLE "{schema}"."{table}" RESTART IDENTITY CASCADE'))

            df.to_sql(
                table,
                conn,
                schema=schema,
                if_exists="append",
                index=False,
                method="multi",
                chunksize=500,
            )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate OptionFlow SQLite databases to PostgreSQL."
    )
    parser.add_argument(
        "--pg",
        required=True,
        help="Postgres connection URL, e.g. postgresql://user:pass@host:5432/optionflow",
    )
    parser.add_argument(
        "--db-dir",
        default=None,
        help="Directory containing the .db files (default: repo root)",
    )
    parser.add_argument(
        "--domain",
        choices=list(DOMAIN_MAP.keys()),
        default=None,
        help="Migrate only one domain (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print row counts without writing to Postgres",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Truncate target tables before inserting (idempotent re-runs)",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    db_dir = Path(args.db_dir) if args.db_dir else repo_root

    if args.dry_run:
        print("DRY-RUN mode — no data will be written to Postgres\n")

    try:
        pg_eng = sqlalchemy.create_engine(args.pg)
        with pg_eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"Connected to Postgres: {args.pg}\n")
    except Exception as exc:
        print(f"ERROR: Could not connect to Postgres: {exc}", file=sys.stderr)
        sys.exit(1)

    domains = [args.domain] if args.domain else list(DOMAIN_MAP.keys())
    for domain in domains:
        print(f"[{domain}]")
        migrate_domain(domain, db_dir, pg_eng, dry_run=args.dry_run, truncate=args.truncate)
        print()

    print("Done." if not args.dry_run else "Dry-run complete — re-run without --dry-run to write data.")


if __name__ == "__main__":
    main()
