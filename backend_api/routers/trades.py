"""backend_api/routers/trades.py — Trade journal & order management routes."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import pandas as pd
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException

from logic import services
from ..schemas import (
    AccountCreateRequest,
    AccountOut,
    HoldingOut,
    HoldingUpsertRequest,
    OrderCreateRequest,
    OrderFillRequest,
    OrderOut,
    TradeCloseRequest,
    TradeCreateRequest,
    TradeOut,
    TradeUpdateRequest,
)
from ..deps import get_current_user

router = APIRouter(tags=["trades"])


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


# ── Accounts ──────────────────────────────────────────────────────────────────

@router.get("/accounts", response_model=List[AccountOut])
def list_accounts(user=Depends(get_current_user)) -> List[AccountOut]:
    rows = services.list_accounts(user_id=int(user["sub"]))
    return [
        AccountOut(
            id=int(r.get("id")),
            name=str(r.get("name") or ""),
            broker=(str(r.get("broker") or "") or None),
            currency=str(r.get("currency") or "USD"),
            created_at=r.get("created_at"),
        )
        for r in rows
    ]


@router.post("/accounts", response_model=AccountOut)
def create_account(req: AccountCreateRequest, user=Depends(get_current_user)) -> AccountOut:
    try:
        account_id = services.create_account(
            user_id=int(user["sub"]),
            name=req.name,
            broker=req.broker,
            currency=req.currency,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return AccountOut(
        id=int(account_id), name=str(req.name),
        broker=req.broker, currency=str(req.currency).upper(),
    )


@router.get("/accounts/{account_id}/holdings", response_model=List[HoldingOut])
def list_account_holdings(account_id: int, user=Depends(get_current_user)) -> List[HoldingOut]:
    try:
        rows = services.list_holdings(user_id=int(user["sub"]), account_id=int(account_id))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return [
        HoldingOut(
            id=int(r.get("id")),
            account_id=int(r.get("account_id")),
            symbol=str(r.get("symbol") or ""),
            quantity=float(r.get("quantity") or 0.0),
            avg_cost=r.get("avg_cost"),
            updated_at=r.get("updated_at"),
        )
        for r in rows
    ]


@router.put("/accounts/{account_id}/holdings", response_model=HoldingOut)
def upsert_account_holding(
    account_id: int, req: HoldingUpsertRequest, user=Depends(get_current_user)
) -> HoldingOut:
    try:
        r = services.upsert_holding(
            user_id=int(user["sub"]),
            account_id=int(account_id),
            symbol=req.symbol,
            quantity=float(req.quantity),
            avg_cost=req.avg_cost,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return HoldingOut(
        id=int(r.get("id")),
        account_id=int(r.get("account_id")),
        symbol=str(r.get("symbol") or ""),
        quantity=float(r.get("quantity") or 0.0),
        avg_cost=r.get("avg_cost"),
        updated_at=r.get("updated_at"),
    )


@router.delete("/holdings/{holding_id}")
def delete_account_holding(holding_id: int, user=Depends(get_current_user)) -> Dict[str, str]:
    ok = services.delete_holding(user_id=int(user["sub"]), holding_id=int(holding_id))
    if not ok:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"status": "ok"}


# ── Orders ────────────────────────────────────────────────────────────────────

@router.get("/orders", response_model=List[OrderOut])
def list_orders(
    user=Depends(get_current_user),
    limit: int = 200,
    offset: int = 0,
) -> List[OrderOut]:
    rows = services.list_orders(user_id=int(user["sub"]))
    paginated = rows[offset: offset + limit]
    return [
        OrderOut(
            id=int(r.get("id")),
            symbol=str(r.get("symbol") or ""),
            instrument=str(r.get("instrument") or ""),
            action=str(r.get("action") or ""),
            strategy=(str(r.get("strategy") or "") or None),
            quantity=int(r.get("quantity") or 0),
            limit_price=r.get("limit_price"),
            status=str(r.get("status") or ""),
            created_at=r.get("created_at"),
            filled_at=r.get("filled_at"),
            filled_price=r.get("filled_price"),
            trade_id=(int(r.get("trade_id")) if r.get("trade_id") is not None else None),
            client_order_id=(str(r.get("client_order_id") or "") or None),
            external_order_id=(str(r.get("external_order_id") or "") or None),
            venue=(str(r.get("venue") or "") or None),
            external_status=(str(r.get("external_status") or "") or None),
            last_synced_at=r.get("last_synced_at"),
        )
        for r in paginated
    ]


@router.post("/orders", response_model=Dict[str, Any])
def create_order(req: OrderCreateRequest, user=Depends(get_current_user)) -> Dict[str, Any]:
    try:
        oid = services.create_order(
            user_id=int(user["sub"]),
            symbol=req.symbol,
            instrument=req.instrument,
            action=req.action,
            strategy=req.strategy,
            qty=int(req.qty),
            limit_price=req.limit_price,
            client_order_id=req.client_order_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok", "order_id": int(oid)}


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: int, user=Depends(get_current_user)) -> Dict[str, str]:
    ok = services.cancel_order(user_id=int(user["sub"]), order_id=int(order_id))
    if not ok:
        raise HTTPException(status_code=400, detail="Order not found or not cancelable")
    return {"status": "ok"}


@router.post("/orders/{order_id}/fill", response_model=Dict[str, Any])
def fill_order(order_id: int, req: OrderFillRequest, user=Depends(get_current_user)) -> Dict[str, Any]:
    try:
        trade_id = services.fill_order(
            user_id=int(user["sub"]),
            order_id=int(order_id),
            filled_price=float(req.filled_price),
            filled_at=req.filled_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok", "trade_id": int(trade_id)}


@router.post("/orders/{order_id}/sync")
def sync_order(order_id: int, user=Depends(get_current_user)) -> Dict[str, str]:
    ok = services.sync_order_status(user_id=int(user["sub"]), order_id=int(order_id))
    if not ok:
        raise HTTPException(status_code=400, detail="Order not found, not linked to broker, or broker disabled")
    return {"status": "ok"}


@router.post("/orders/sync-pending")
def sync_pending_orders(user=Depends(get_current_user)) -> Dict[str, int]:
    n = services.sync_pending_orders(user_id=int(user["sub"]))
    return {"status": 0, "updated": int(n)}


@router.post("/orders/{order_id}/fill-external", response_model=Dict[str, Any])
def fill_order_external(
    order_id: int, req: OrderFillRequest, user=Depends(get_current_user)
) -> Dict[str, Any]:
    try:
        trade_id = services.fill_order_via_broker(
            user_id=int(user["sub"]),
            order_id=int(order_id),
            filled_price=float(req.filled_price),
            filled_at=req.filled_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok", "trade_id": int(trade_id)}


@router.get("/orders/{order_id}/events", response_model=List[Dict[str, Any]])
def order_events(
    order_id: int,
    user=Depends(get_current_user),
    limit: int = 200,
) -> List[Dict[str, Any]]:
    rows = services.list_order_events(
        user_id=int(user["sub"]), order_id=int(order_id), limit=int(limit)
    )
    cleaned: List[Dict[str, Any]] = []
    for r in rows:
        rec: Dict[str, Any] = dict(r)
        v = rec.get("created_at")
        if isinstance(v, (pd.Timestamp, datetime)):
            rec["created_at"] = pd.to_datetime(v).to_pydatetime().isoformat()
        cleaned.append(rec)
    return cleaned


# ── Trades ────────────────────────────────────────────────────────────────────

@router.get("/trades", response_model=List[Dict[str, Any]])
def list_trades(
    user=Depends(get_current_user),
    limit: int = 200,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    trades, _, _ = services.load_data(user_id=int(user["sub"]))
    records = _df_records(trades)
    return records[offset: offset + limit]


@router.post("/trades")
def create_trade(req: TradeCreateRequest, user=Depends(get_current_user)) -> Dict[str, str]:
    services.save_trade(
        req.symbol, req.instrument, req.strategy, req.action,
        req.qty, req.price, req.date,
        user_id=int(user["sub"]),
        client_order_id=req.client_order_id,
    )
    return {"status": "ok"}


@router.put("/trades/{trade_id}")
def update_trade(
    trade_id: int, req: TradeUpdateRequest, user=Depends(get_current_user)
) -> Dict[str, str]:
    ok = services.update_trade(
        trade_id, req.symbol, req.strategy, req.action,
        req.qty, req.price, req.date, user_id=int(user["sub"]),
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Trade not found")
    return {"status": "ok"}


@router.post("/trades/{trade_id}/close")
def close_trade(
    trade_id: int, req: TradeCloseRequest, user=Depends(get_current_user)
) -> Dict[str, str]:
    ok = services.close_trade(
        trade_id, req.exit_price, exit_date=req.exit_date, user_id=int(user["sub"])
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Trade not found or already closed")
    return {"status": "ok"}


@router.delete("/trades/{trade_id}")
def delete_trade(trade_id: int, user=Depends(get_current_user)) -> Dict[str, str]:
    ok = services.delete_trade(trade_id, user_id=int(user["sub"]))
    if not ok:
        raise HTTPException(status_code=404, detail="Trade not found")
    return {"status": "ok"}
