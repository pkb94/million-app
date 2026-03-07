"""
One-time migration: fix adjusted_cost_basis on CLOSED holdings that were
manually closed before the formula fix.

Old behaviour: adj_basis was left unchanged on close (= cost_basis - premium).
New behaviour: adj_basis = old_adj + (cost_basis - close_price)
               i.e. absorbs the stock gain/loss so it reflects total net result.

Detects close_price from the MANUAL HoldingEvent description ("sold @ $XX.XX").
"""
import sqlite3
import re
from datetime import datetime

DB = "portfolio.db"
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

rows = conn.execute("""
    SELECT h.id, h.symbol, h.cost_basis, h.adjusted_cost_basis,
           e.id AS event_id, e.description, e.realized_gain
    FROM stock_holdings h
    JOIN holding_events e ON e.holding_id = h.id
    WHERE h.status = 'CLOSED'
      AND e.event_type = 'MANUAL'
      AND e.shares_delta < 0
""").fetchall()

fixed = 0
for r in rows:
    desc = r["description"] or ""
    m = re.search(r"sold @ \$([0-9.]+)", desc)
    if not m:
        print(f"  {r['symbol']} id={r['id']}: no close price found in event, skipping")
        continue

    close_price = float(m.group(1))
    cost_basis  = r["cost_basis"]
    old_adj     = r["adjusted_cost_basis"]
    new_adj     = round(old_adj + (cost_basis - close_price), 4)

    if abs(new_adj - old_adj) < 0.0001:
        print(f"  {r['symbol']} id={r['id']}: already correct ({old_adj}), skip")
        continue

    conn.execute(
        "UPDATE stock_holdings SET adjusted_cost_basis=?, updated_at=? WHERE id=?",
        (new_adj, datetime.utcnow().isoformat(), r["id"]),
    )
    # Update the event's basis_delta to reflect new_adj - old_adj
    conn.execute(
        "UPDATE holding_events SET basis_delta=? WHERE id=?",
        (round(new_adj - old_adj, 4), r["event_id"]),
    )
    print(f"  FIXED {r['symbol']} id={r['id']}: adj {old_adj} → {new_adj}  "
          f"(close={close_price}, cost={cost_basis})")
    fixed += 1

conn.commit()
conn.close()
print(f"\nDone. {fixed} holding(s) updated.")
