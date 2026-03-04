"""backend_api/routers/portfolio.py — Portfolio, holdings, options positions & premium routes."""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from ..deps import get_current_user

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


# ── Weekly snapshots ──────────────────────────────────────────────────────────

@router.get("/weeks", response_model=List[Dict[str, Any]])
def list_weeks(user=Depends(get_current_user)) -> List[Dict[str, Any]]:
    from logic.portfolio import list_weeks as _list_weeks
    return _list_weeks(user_id=int(user["sub"]))


@router.post("/weeks", response_model=Dict[str, Any])
def get_or_create_week(body: Dict[str, Any], user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.portfolio import get_or_create_week as _get_or_create, _parse_dt
    for_date = _parse_dt(body.get("for_date"))
    return _get_or_create(user_id=int(user["sub"]), for_date=for_date)


@router.get("/weeks/{week_id}", response_model=Dict[str, Any])
def get_week(week_id: int, user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.portfolio import get_week as _get_week
    w = _get_week(user_id=int(user["sub"]), week_id=week_id)
    if w is None:
        raise HTTPException(status_code=404, detail="Week not found")
    return w


@router.patch("/weeks/{week_id}", response_model=Dict[str, Any])
def update_week(week_id: int, body: Dict[str, Any], user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.portfolio import update_week as _update_week
    try:
        return _update_week(
            user_id=int(user["sub"]), week_id=week_id,
            account_value=body.get("account_value"), notes=body.get("notes"),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/weeks/{week_id}/complete", response_model=Dict[str, Any])
def mark_week_complete(
    week_id: int, body: Dict[str, Any], user=Depends(get_current_user)
) -> Dict[str, Any]:
    from logic.portfolio import mark_week_complete as _complete
    try:
        return _complete(
            user_id=int(user["sub"]), week_id=week_id,
            account_value=body.get("account_value"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/weeks/{week_id}/reopen", response_model=Dict[str, Any])
def reopen_week(week_id: int, user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.portfolio import reopen_week as _reopen
    try:
        return _reopen(user_id=int(user["sub"]), week_id=week_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Positions ─────────────────────────────────────────────────────────────────

@router.get("/weeks/{week_id}/positions", response_model=List[Dict[str, Any]])
def list_positions(week_id: int, user=Depends(get_current_user)) -> List[Dict[str, Any]]:
    from logic.portfolio import list_positions as _list_positions
    return _list_positions(user_id=int(user["sub"]), week_id=week_id)


@router.post("/weeks/{week_id}/positions", response_model=Dict[str, Any])
def create_position(
    week_id: int, body: Dict[str, Any], user=Depends(get_current_user)
) -> Dict[str, Any]:
    from logic.portfolio import create_position as _create
    try:
        return _create(user_id=int(user["sub"]), week_id=week_id, data=body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/positions/{position_id}", response_model=Dict[str, Any])
def update_position(
    position_id: int, body: Dict[str, Any], user=Depends(get_current_user)
) -> Dict[str, Any]:
    from logic.portfolio import update_position as _update
    from logic.holdings import apply_position_status_change as _apply_holding
    try:
        result = _update(user_id=int(user["sub"]), position_id=position_id, data=body)
        if "status" in body:
            try:
                _apply_holding(
                    user_id=int(user["sub"]),
                    position_id=position_id,
                    new_status=body["status"],
                )
            except Exception:
                pass
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/positions/{position_id}")
def delete_position(position_id: int, user=Depends(get_current_user)) -> Dict[str, str]:
    from logic.portfolio import delete_position as _delete
    try:
        _delete(user_id=int(user["sub"]), position_id=position_id)
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Assignments ───────────────────────────────────────────────────────────────

@router.post("/positions/{position_id}/assign", response_model=Dict[str, Any])
def create_assignment(
    position_id: int, body: Dict[str, Any], user=Depends(get_current_user)
) -> Dict[str, Any]:
    from logic.portfolio import create_assignment as _assign
    try:
        return _assign(user_id=int(user["sub"]), position_id=position_id, data=body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/positions/{position_id}/assignment", response_model=Dict[str, Any])
def get_assignment(position_id: int, user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.portfolio import get_assignment_for_position as _get_assign
    a = _get_assign(user_id=int(user["sub"]), position_id=position_id)
    if a is None:
        raise HTTPException(status_code=404, detail="No assignment found")
    return a


@router.patch("/assignments/{assignment_id}", response_model=Dict[str, Any])
def update_assignment(
    assignment_id: int, body: Dict[str, Any], user=Depends(get_current_user)
) -> Dict[str, Any]:
    from logic.portfolio import update_assignment as _update_assign
    try:
        return _update_assign(
            user_id=int(user["sub"]), assignment_id=assignment_id, data=body
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Summary & symbols ─────────────────────────────────────────────────────────

@router.get("/summary", response_model=Dict[str, Any])
def portfolio_summary(user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.portfolio import portfolio_summary as _summary
    return _summary(user_id=int(user["sub"]))


@router.get("/symbols", response_model=List[Dict[str, Any]])
def symbol_summary(user=Depends(get_current_user)) -> List[Dict[str, Any]]:
    from logic.portfolio import symbol_summary as _sym_summary
    return _sym_summary(user_id=int(user["sub"]))


# ── Stock Holdings ────────────────────────────────────────────────────────────

@router.get("/holdings", response_model=List[Dict[str, Any]])
def list_stock_holdings(user=Depends(get_current_user)) -> List[Dict[str, Any]]:
    from logic.holdings import list_holdings as _list
    return _list(user_id=int(user["sub"]))


@router.post("/holdings", response_model=Dict[str, Any])
def create_stock_holding(body: Dict[str, Any], user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.holdings import create_holding as _create
    try:
        return _create(user_id=int(user["sub"]), data=body)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/holdings/seed-from-positions", response_model=Dict[str, Any])
def seed_holdings_from_positions(user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.holdings import seed_holdings_from_positions as _seed
    return _seed(user_id=int(user["sub"]))


@router.post("/holdings/recalculate", response_model=Dict[str, Any])
def recalculate_holdings(user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.holdings import recalculate_all_holdings as _recalc
    return _recalc(user_id=int(user["sub"]))


@router.post("/holdings/sync-ledger", response_model=Dict[str, Any])
def sync_premium_ledger(user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.premium_ledger import sync_ledger_from_positions as _sync
    from logic.holdings import recalculate_all_holdings as _recalc
    sync_result = _sync(user_id=int(user["sub"]))
    recalc_result = _recalc(user_id=int(user["sub"]))
    return {"synced_rows": sync_result["upserted"], "updated_holdings": recalc_result["updated"]}


@router.get("/premium-dashboard", response_model=Dict[str, Any])
def get_premium_dashboard(user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.premium_ledger import get_premium_dashboard as _dash
    return _dash(user_id=int(user["sub"]))


@router.get("/holdings/{holding_id}/premium-ledger", response_model=Dict[str, Any])
def get_holding_premium_ledger(holding_id: int, user=Depends(get_current_user)) -> Dict[str, Any]:
    from logic.premium_ledger import get_premium_summary as _summary
    return _summary(holding_id=holding_id)


@router.patch("/holdings/{holding_id}", response_model=Dict[str, Any])
def update_stock_holding(
    holding_id: int, body: Dict[str, Any], user=Depends(get_current_user)
) -> Dict[str, Any]:
    from logic.holdings import update_holding as _update
    try:
        return _update(user_id=int(user["sub"]), holding_id=holding_id, data=body)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/holdings/{holding_id}")
def delete_stock_holding(holding_id: int, user=Depends(get_current_user)) -> Dict[str, str]:
    from logic.holdings import delete_holding as _delete
    try:
        _delete(user_id=int(user["sub"]), holding_id=holding_id)
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/holdings/{holding_id}/events", response_model=List[Dict[str, Any]])
def list_holding_events(holding_id: int, user=Depends(get_current_user)) -> List[Dict[str, Any]]:
    from logic.holdings import list_holding_events as _events
    return _events(user_id=int(user["sub"]), holding_id=holding_id)
