"""backend_api/main.py — Thin application factory.

All route logic lives in backend_api/routers/*.py.
This module only:
  1. Loads .env
  2. Defines shared module-level state (caches, poller, helpers)
  3. Creates the FastAPI app and registers middleware + routers
  4. Runs DB init & starts background poller on startup
"""
from __future__ import annotations

import logging
import os
import re
import sqlite3 as _sqlite3
import threading
import time
from datetime import datetime, timezone, timedelta as _td
from datetime import timezone as _tz
from pathlib import Path as _Path
from typing import Any, Dict, List, Set

import pandas as pd
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from database.models import init_db

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

# ── GEX cache ─────────────────────────────────────────────────────────────────
_GEX_CACHE_TTL = 10
_gex_cache: dict[str, tuple[float, Any]] = {}

# ── Background poller state ───────────────────────────────────────────────────
_POLL_INTERVAL = 10
_watched: Set[str] = set()
_watched_lock = threading.Lock()
_watched_ttl: dict[str, float] = {}
_WATCH_TTL = 120

_RANGE_INTERVAL: dict[int, str] = {
    1: "1m", 2: "5m", 3: "5m", 7: "30m", 14: "30m", 30: "1d",
}
_backfilled: set[tuple[str, int]] = set()
_backfill_lock = threading.Lock()

# ── Flow snapshot store ───────────────────────────────────────────────────────
_FLOW_DB = _Path(__file__).parent.parent / "markets.db"


def _flow_db() -> _sqlite3.Connection:
    con = _sqlite3.connect(str(_FLOW_DB))
    con.execute("""
        CREATE TABLE IF NOT EXISTS net_flow_snapshots (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol     TEXT    NOT NULL,
            ts         TEXT    NOT NULL,
            price      REAL    NOT NULL,
            call_prem  REAL    NOT NULL,
            put_prem   REAL    NOT NULL,
            net_flow   REAL    NOT NULL,
            total_prem REAL    NOT NULL DEFAULT 0,
            volume     INTEGER NOT NULL DEFAULT 0
        )
    """)
    for col, typ in [("total_prem", "REAL NOT NULL DEFAULT 0"), ("volume", "INTEGER NOT NULL DEFAULT 0")]:
        try:
            con.execute(f"ALTER TABLE net_flow_snapshots ADD COLUMN {col} {typ}")
        except _sqlite3.OperationalError:
            pass
    con.execute("CREATE INDEX IF NOT EXISTS idx_nf_sym_ts ON net_flow_snapshots (symbol, ts)")
    con.execute("""
        UPDATE net_flow_snapshots
        SET ts = REPLACE(REPLACE(ts, '+00:00', 'Z'), ' ', 'T')
        WHERE ts LIKE '%+00:00' OR ts LIKE '% %'
    """)
    con.commit()
    return con


def _record_flow_snapshot(symbol: str, spot: float, call_prem: float, put_prem: float,
                          net_flow: float, total_prem: float = 0.0, volume: int = 0) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        with _flow_db() as con:
            con.execute(
                "INSERT INTO net_flow_snapshots "
                "(symbol,ts,price,call_prem,put_prem,net_flow,total_prem,volume) "
                "VALUES (?,?,?,?,?,?,?,?)",
                (symbol, ts, round(spot, 2), round(call_prem, 0), round(put_prem, 0),
                 round(net_flow, 0), round(total_prem, 0), int(volume)),
            )
    except Exception as exc:
        logger.error("_record_flow_snapshot failed for %s: %s", symbol, exc)


def _backfill_history(sym: str, days: int) -> None:
    import yfinance as yf
    key = (sym, days)
    with _backfill_lock:
        if key in _backfilled:
            return
        _backfilled.add(key)
    try:
        interval = _RANGE_INTERVAL.get(days, "5m")
        period_map = {1: "1d", 2: "2d", 3: "5d", 7: "5d", 14: "1mo", 30: "1mo"}
        period = period_map.get(days, f"{days}d")
        ticker = yf.Ticker(sym)
        bars = ticker.history(period=period, interval=interval, progress=False)
        if bars is None or bars.empty:
            return
        if bars.index.tz is None:
            bars.index = bars.index.tz_localize("UTC")
        else:
            bars.index = bars.index.tz_convert("UTC")
        cutoff = datetime.now(_tz.utc) - _td(days=days)
        bars = bars[bars.index >= cutoff]
        if bars.empty:
            return
        call_ratio, put_ratio, prem_per_share = 0.55, 0.45, 0.5
        try:
            from logic.gamma import compute_gamma_exposure
            cached = _gex_cache.get(sym)
            result = cached[1] if cached else compute_gamma_exposure(sym)
            if not cached:
                _gex_cache[sym] = (time.monotonic(), result)
            total = (result.call_premium or 0) + (result.put_premium or 0)
            if total > 0:
                call_ratio = result.call_premium / total
                put_ratio = result.put_premium / total
            prem_per_share = total / max(result.total_volume or 1, 1)
        except Exception:
            pass
        since_iso = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")
        with _flow_db() as con:
            existing = {r[0] for r in con.execute(
                "SELECT ts FROM net_flow_snapshots WHERE symbol=? AND ts>=?",
                (sym, since_iso),
            ).fetchall()}
        rows_to_insert = []
        for ts_idx, row in bars.iterrows():
            raw_ts = ts_idx.isoformat(timespec="seconds")
            ts_str = raw_ts.replace(" ", "T")
            ts_str = re.sub(r"[+-]00:?00$", "Z", ts_str)
            if not ts_str.endswith("Z") and "+" not in ts_str and ts_str.count("-") == 2:
                ts_str += "Z"
            if ts_str in existing:
                continue
            price = float(row.get("Close", 0) or row.get("close", 0) or 0)
            volume = int(row.get("Volume", 0) or row.get("volume", 0) or 0)
            if price <= 0:
                continue
            est_total = volume * prem_per_share
            cp = round(est_total * call_ratio, 0)
            pp = round(est_total * put_ratio, 0)
            rows_to_insert.append(
                (sym, ts_str, round(price, 2), cp, pp, round(cp - pp, 0), round(est_total, 0), volume)
            )
        if rows_to_insert:
            with _flow_db() as con:
                con.executemany(
                    "INSERT OR IGNORE INTO net_flow_snapshots "
                    "(symbol,ts,price,call_prem,put_prem,net_flow,total_prem,volume) "
                    "VALUES (?,?,?,?,?,?,?,?)",
                    rows_to_insert,
                )
    except Exception as exc:
        logger.error("_backfill_history %s %dd failed: %s", sym, days, exc)
        with _backfill_lock:
            _backfilled.discard(key)


def _background_poller() -> None:
    from logic.gamma import compute_gamma_exposure
    last_date = datetime.now(_tz.utc).date()
    while True:
        time.sleep(_POLL_INTERVAL)
        now = time.monotonic()
        today = datetime.now(_tz.utc).date()
        if today != last_date:
            with _backfill_lock:
                _backfilled.clear()
            last_date = today
        with _watched_lock:
            expired = [s for s, t in _watched_ttl.items() if now - t > _WATCH_TTL]
            for s in expired:
                _watched.discard(s)
                _watched_ttl.pop(s, None)
            symbols = list(_watched)
        for sym in symbols:
            try:
                result = compute_gamma_exposure(sym)
                _gex_cache[sym] = (time.monotonic(), result)
                _record_flow_snapshot(
                    symbol=result.symbol, spot=result.spot,
                    call_prem=result.call_premium, put_prem=result.put_premium,
                    net_flow=result.net_flow,
                    total_prem=result.call_premium + result.put_premium,
                    volume=result.total_volume,
                )
            except Exception as exc:
                logger.debug("Poller error for %s: %s", sym, exc)


# ── Shared helper ─────────────────────────────────────────────────────────────

def _df_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    if df is None or df.empty:
        return []
    out: List[Dict[str, Any]] = []
    for rec in df.to_dict(orient="records"):
        cleaned: Dict[str, Any] = {}
        for k, v in rec.items():
            if isinstance(v, (pd.Timestamp, datetime)):
                cleaned[k] = pd.to_datetime(v).to_pydatetime().isoformat()
            else:
                cleaned[k] = v
        out.append(cleaned)
    return out


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="OptionFlow API",
    version="2.0.0",
    description="Option flow, portfolio, budget and market data API.",
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


# ── Routers ───────────────────────────────────────────────────────────────────
from .routers import auth, trades, portfolio, budget, markets, admin  # noqa: E402

app.include_router(auth.router)
app.include_router(trades.router)
app.include_router(portfolio.router)
app.include_router(budget.router)
app.include_router(markets.router)
app.include_router(admin.router)


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def _startup() -> None:
    init_db()
    threading.Thread(target=_background_poller, daemon=True, name="gex-poller").start()
    logger.info("OptionFlow API v2 started — GEX poller running")


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["meta"])
def health() -> Dict[str, str]:
    return {"status": "ok"}
