"""alembic/env.py — Multi-database migration environment.

OptionFlow uses 5 separate SQLite databases.  Alembic is configured to run
migrations against whichever DB is selected via the ALEMBIC_DB env var (or
falls back to 'users').  Pass --name=<db> to `alembic upgrade` to target a
specific database.

Usage examples:
  ALEMBIC_DB=users    alembic upgrade head
  ALEMBIC_DB=trades   alembic upgrade head
  ALEMBIC_DB=portfolio alembic upgrade head
  ALEMBIC_DB=budget   alembic upgrade head
  ALEMBIC_DB=markets  alembic upgrade head
"""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Allow project root imports.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.models import (  # noqa: E402
    UsersBase, TradesBase, PortfolioBase, BudgetBase, MarketsBase,
)

# ── Database → (url, metadata) mapping ──────────────────────────────────────
_DB_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

_DB_MAP = {
    "users":     (f"sqlite:///{_DB_ROOT}/users.db",     UsersBase.metadata),
    "trades":    (f"sqlite:///{_DB_ROOT}/trades.db",    TradesBase.metadata),
    "portfolio": (f"sqlite:///{_DB_ROOT}/portfolio.db", PortfolioBase.metadata),
    "budget":    (f"sqlite:///{_DB_ROOT}/budget.db",    BudgetBase.metadata),
    "markets":   (f"sqlite:///{_DB_ROOT}/markets.db",   MarketsBase.metadata),
}

# Select active DB — default to 'users' if not set.
_active_db = os.getenv("ALEMBIC_DB", "users")
if _active_db not in _DB_MAP:
    raise ValueError(
        f"ALEMBIC_DB='{_active_db}' is not valid. Choose one of: {list(_DB_MAP)}"
    )
_db_url, target_metadata = _DB_MAP[_active_db]

# ── Alembic config ────────────────────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Allow DATABASE_URL env var to fully override (e.g. for Postgres on prod).
_url_override = os.getenv("DATABASE_URL")
_effective_url = _url_override or _db_url


def run_migrations_offline() -> None:
    context.configure(
        url=_effective_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = {
        "sqlalchemy.url": _effective_url,
    }
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
