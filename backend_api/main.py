"""backend_api/main.py — Thin application factory.

All route logic lives in backend_api/routers/*.py.
Shared state (caches, poller, flow-DB helpers) lives in backend_api/state.py.
This module only:
  1. Loads .env
  2. Creates the FastAPI app and registers middleware, routers and exception handlers
  3. Runs DB init & starts background poller on startup
"""
from __future__ import annotations

import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from database.models import init_db, get_users_session

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("optionflow.main")

# ── Load .env ─────────────────────────────────────────────────────────────────

def _load_dotenv() -> None:
    env_path = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    if not os.path.isfile(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val

_load_dotenv()

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Run startup tasks before yield; shutdown tasks after."""
    from .state import _init_flow_db, _background_poller

    init_db()
    _init_flow_db()
    threading.Thread(target=_background_poller, daemon=True, name="gex-poller").start()
    logger.info("OptionFlow API v2.2.0 started — GEX poller running")
    yield
    # (shutdown: nothing to clean up — poller is a daemon thread)


app = FastAPI(
    title="OptionFlow API",
    version="2.2.0",
    description="Option flow, portfolio, budget and market data API.",
    lifespan=_lifespan,
)

_cors_origins_raw = os.getenv("CORS_ALLOW_ORIGINS", "*")
_cors_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]
_cors_is_wildcard = len(_cors_origins) == 1 and _cors_origins[0] == "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False if _cors_is_wildcard else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request logging middleware ────────────────────────────────────────────────
_req_logger = logging.getLogger("optionflow.requests")


@app.middleware("http")
async def _log_requests(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    _req_logger.info("%s %s → %d  %.1fms", request.method, request.url.path, response.status_code, ms)
    return response


# ── Global exception handler ──────────────────────────────────────────────────

@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "Unhandled error on %s %s: %s", request.method, request.url.path, exc
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ── Routers ───────────────────────────────────────────────────────────────────
from .routers import auth, trades, portfolio, budget, markets, admin  # noqa: E402

app.include_router(auth.router)
app.include_router(trades.router)
app.include_router(portfolio.router)
app.include_router(budget.router)
app.include_router(markets.router)
app.include_router(admin.router)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["meta"])
def health() -> Dict[str, Any]:
    """Liveness + readiness probe: pings the users DB."""
    session = get_users_session()
    try:
        session.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception as exc:
        logger.error("Health check DB ping failed: %s", exc)
        return JSONResponse(status_code=503, content={"status": "error", "db": "unreachable"})
    finally:
        session.close()
