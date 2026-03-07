"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePosition, OptionPosition, PositionStatus } from "@/lib/api";
import { STATUS_COLORS } from "./TradesHelpers";

const PREM_OUT_STATUSES: PositionStatus[] = ["CLOSED", "EXPIRED", "ROLLED"];
// ASSIGNED is intentionally omitted: assignment happens at the strike price —
// no buyback cost, full premium collected is kept. premium_out = 0 is sent automatically.

export function StatusSelect({ pos, isCarried = false }: { pos: OptionPosition; isCarried?: boolean }) {
  const qc = useQueryClient();
  const [pendingStatus, setPendingStatus] = useState<PositionStatus | null>(null);
  const [premOut, setPremOut] = useState(
    pos.premium_out != null ? String(pos.premium_out) : ""
  );
  const [err, setErr] = useState("");

  const needsPremOut = (s: PositionStatus) => PREM_OUT_STATUSES.includes(s);

  const saveMut = useMutation({
    mutationFn: (body: { status: PositionStatus; premium_out?: number | null }) =>
      updatePosition(pos.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["positions", pos.week_id] });
      setPendingStatus(null);
      setErr("");
    },
    onError: (e: Error) => setErr(e.message),
  });

  function handleStatusChange(newStatus: PositionStatus) {
    // For carried positions, warn the user before changing away from ACTIVE
    if (isCarried && newStatus !== "ACTIVE" && pos.status === "ACTIVE") {
      if (!window.confirm(
        `This position was opened in a prior week.\n\nChanging it to "${newStatus}" will update the original trade.\n\nAre you sure?`
      )) return;
    }
    if (needsPremOut(newStatus)) {
      setPendingStatus(newStatus);
      setPremOut(pos.premium_out != null ? String(pos.premium_out) : "");
    } else if (newStatus === "ASSIGNED") {
      // Assignment is exercised at strike — no buyback, full premium is kept.
      // Send premium_out=0 so the ledger treats the full premium_in as realized.
      saveMut.mutate({ status: newStatus, premium_out: 0 });
    } else {
      saveMut.mutate({ status: newStatus, premium_out: null });
    }
  }

  function handleConfirm() {
    if (!pendingStatus) return;
    const parsed = premOut !== "" ? parseFloat(premOut) : null;
    saveMut.mutate({ status: pendingStatus, premium_out: parsed });
  }

  const premIn   = pos.premium_in ?? 0;
  const premOutV = parseFloat(premOut) || 0;
  const isLoss   = premOut !== "" && Math.abs(premOutV) > premIn;
  const netPL    = premOut !== "" ? (premIn + premOutV) * pos.contracts * 100 : null;
  const displayStatus = pendingStatus ?? pos.status;

  // Suppress TS warning — STATUS_COLORS is used for badge elsewhere; keep import
  void STATUS_COLORS;

  return (
    <div className="flex flex-col gap-1.5 min-w-[110px]">
      <select
        value={displayStatus}
        onChange={(e) => handleStatusChange(e.target.value as PositionStatus)}
        disabled={saveMut.isPending}
        className="text-[11px] border border-[var(--border)] rounded-lg px-2 py-1 bg-[var(--surface)] text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {(["ACTIVE", "CLOSED", "EXPIRED", "ASSIGNED", "ROLLED"] as PositionStatus[]).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {pendingStatus && needsPremOut(pendingStatus) && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.01"
              value={premOut}
              onChange={(e) => setPremOut(e.target.value)}
              placeholder="Prem Out (e.g. −0.45)"
              autoFocus
              className={`w-full text-[11px] border rounded-lg px-2 py-1 bg-[var(--surface)] text-foreground focus:outline-none focus:ring-1 ${
                isLoss ? "border-red-400 focus:ring-red-400" : "border-[var(--border)] focus:ring-green-500"
              }`}
            />
            <button
              onClick={handleConfirm}
              disabled={saveMut.isPending}
              className="shrink-0 text-[10px] px-2 py-1 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-50 transition"
            >
              {saveMut.isPending ? "…" : "✓"}
            </button>
            <button
              onClick={() => { setPendingStatus(null); setErr(""); }}
              className="shrink-0 text-[10px] px-1.5 py-1 rounded-lg border border-[var(--border)] text-foreground/60 hover:bg-[var(--surface-2)] transition"
            >
              ✕
            </button>
          </div>
          {netPL !== null && (
            <span className={`text-[10px] font-semibold ${isLoss ? "text-red-500" : "text-green-500"}`}>
              net {netPL >= 0 ? "+" : ""}${netPL.toFixed(0)}
              {isLoss && <span className="ml-1 text-[9px] bg-red-100 dark:bg-red-900/40 px-1 rounded">LOSS</span>}
            </span>
          )}
          {err && <span className="text-[10px] text-red-500">{err}</span>}
        </div>
      )}
    </div>
  );
}
