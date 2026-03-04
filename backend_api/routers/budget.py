"""backend_api/routers/budget.py — Budget, cash flow, credit card & ledger routes."""
from __future__ import annotations

from typing import Any, Dict, List

import pandas as pd
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException

from logic import services
from ..schemas import (
    BudgetCreateRequest,
    BudgetOut,
    BudgetOverrideOut,
    BudgetOverrideRequest,
    CashCreateRequest,
    CashOut,
    CreditCardWeekOut,
    CreditCardWeekRequest,
)
from ..deps import get_current_user

router = APIRouter(tags=["budget"])


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


# ── Cash ──────────────────────────────────────────────────────────────────────

@router.get("/cash", response_model=List[Dict[str, Any]])
def list_cash(
    user=Depends(get_current_user),
    limit: int = 200,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    _, cash, _ = services.load_data(user_id=int(user["sub"]))
    records = _df_records(cash)
    return records[offset: offset + limit]


@router.get("/cash/balance")
def cash_balance(user=Depends(get_current_user), currency: str = "USD") -> Dict[str, Any]:
    cur = str(currency or "USD").strip().upper() or "USD"
    bal = services.get_cash_balance(user_id=int(user["sub"]), currency=cur)
    return {"currency": cur, "balance": float(bal)}


@router.post("/cash")
def create_cash(req: CashCreateRequest, user=Depends(get_current_user)) -> Dict[str, str]:
    services.save_cash(req.action, req.amount, req.date, req.notes, user_id=int(user["sub"]))
    return {"status": "ok"}


# ── Budget ────────────────────────────────────────────────────────────────────

@router.get("/budget", response_model=List[Dict[str, Any]])
def list_budget(
    user=Depends(get_current_user),
    limit: int = 500,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    _, _, budget = services.load_data(user_id=int(user["sub"]))
    records = _df_records(budget)
    return records[offset: offset + limit]


@router.post("/budget")
def create_budget(req: BudgetCreateRequest, user=Depends(get_current_user)) -> Dict[str, str]:
    services.save_budget(
        req.category, req.type, req.amount, req.date, req.description,
        user_id=int(user["sub"]),
        entry_type=req.entry_type,
        recurrence=req.recurrence,
        merchant=req.merchant,
        active_until=req.active_until,
    )
    return {"status": "ok"}


@router.patch("/budget/{budget_id}")
def patch_budget(
    budget_id: int, req: BudgetCreateRequest, user=Depends(get_current_user)
) -> Dict[str, str]:
    services.update_budget(
        budget_id, user_id=int(user["sub"]),
        category=req.category, type=req.type,
        entry_type=req.entry_type, recurrence=req.recurrence,
        amount=req.amount, date=req.date, description=req.description,
        merchant=req.merchant, active_until=req.active_until,
    )
    return {"status": "ok"}


@router.delete("/budget/{budget_id}")
def remove_budget(budget_id: int, user=Depends(get_current_user)) -> Dict[str, str]:
    uid = int(user["sub"])
    services.delete_budget_overrides_for_entry(budget_id, user_id=uid)
    services.delete_budget(budget_id, user_id=uid)
    return {"status": "ok"}


# ── Budget Overrides ──────────────────────────────────────────────────────────

@router.get("/budget-overrides", response_model=List[Dict[str, Any]])
def list_overrides(user=Depends(get_current_user)) -> List[Dict[str, Any]]:
    return services.list_budget_overrides(user_id=int(user["sub"]))


@router.post("/budget-overrides", response_model=Dict[str, Any])
def upsert_override(
    req: BudgetOverrideRequest, user=Depends(get_current_user)
) -> Dict[str, Any]:
    oid = services.upsert_budget_override(
        user_id=int(user["sub"]),
        budget_id=req.budget_id,
        month_key=req.month_key,
        amount=req.amount,
        description=req.description,
    )
    return {"id": oid}


@router.delete("/budget-overrides/{override_id}")
def delete_override(override_id: int, user=Depends(get_current_user)) -> Dict[str, str]:
    services.delete_budget_override(override_id, user_id=int(user["sub"]))
    return {"status": "ok"}


# ── Credit Card Weeks ─────────────────────────────────────────────────────────

@router.get("/credit-card/weeks", response_model=List[Dict[str, Any]])
def list_cc_weeks(user=Depends(get_current_user)) -> List[Dict[str, Any]]:
    return services.list_credit_card_weeks(user_id=int(user["sub"]))


@router.post("/credit-card/weeks", response_model=Dict[str, Any])
def create_cc_week(
    req: CreditCardWeekRequest, user=Depends(get_current_user)
) -> Dict[str, Any]:
    row_id = services.create_credit_card_week(
        user_id=int(user["sub"]),
        week_start=req.week_start,
        balance=req.balance,
        squared_off=req.squared_off,
        paid_amount=req.paid_amount,
        note=req.note,
        card_name=req.card_name,
    )
    return {"id": row_id, "status": "ok"}


@router.patch("/credit-card/weeks/{row_id}", response_model=Dict[str, str])
def patch_cc_week(
    row_id: int, req: CreditCardWeekRequest, user=Depends(get_current_user)
) -> Dict[str, str]:
    services.update_credit_card_week(
        row_id, user_id=int(user["sub"]),
        week_start=req.week_start,
        balance=req.balance,
        squared_off=req.squared_off,
        paid_amount=req.paid_amount,
        note=req.note,
        card_name=req.card_name,
    )
    return {"status": "ok"}


@router.delete("/credit-card/weeks/{row_id}", response_model=Dict[str, str])
def delete_cc_week(row_id: int, user=Depends(get_current_user)) -> Dict[str, str]:
    services.delete_credit_card_week(row_id, user_id=int(user["sub"]))
    return {"status": "ok"}


# ── Ledger ────────────────────────────────────────────────────────────────────

@router.get("/ledger/cash-balance")
def ledger_cash_balance(user=Depends(get_current_user)) -> Dict[str, Any]:
    bal = services.get_cash_balance(user_id=int(user["sub"]), currency="USD")
    return {"currency": "USD", "balance": float(bal)}


@router.get("/ledger/entries", response_model=List[Dict[str, Any]])
def ledger_entries(
    user=Depends(get_current_user),
    limit: int = 100,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    rows = services.list_ledger_entries(user_id=int(user["sub"]), limit=int(limit + offset))
    cleaned: List[Dict[str, Any]] = []
    for r in rows[offset:]:
        rec: Dict[str, Any] = dict(r)
        for k in ("created_at", "effective_at"):
            v = rec.get(k)
            if isinstance(v, (pd.Timestamp, datetime)):
                rec[k] = pd.to_datetime(v).to_pydatetime().isoformat()
        cleaned.append(rec)
    return cleaned
