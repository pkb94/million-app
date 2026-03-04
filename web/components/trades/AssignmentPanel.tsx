"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAssignment, createAssignment, updateAssignment,
  OptionPosition,
} from "@/lib/api";
import { inp } from "./TradesHelpers";

interface AssignFormState {
  shares_acquired: string;
  acquisition_price: string;
  net_option_premium: string;
  notes: string;
}

export function AssignmentPanel({ pos }: { pos: OptionPosition }) {
  const qc = useQueryClient();
  const { data: asgn, isLoading } = useQuery({
    queryKey: ["assignment", pos.id],
    queryFn: () => fetchAssignment(pos.id),
    retry: false,
  });

  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<AssignFormState>({ shares_acquired: "", acquisition_price: "", net_option_premium: "", notes: "" });
  const [err, setErr] = useState("");

  function set(k: keyof AssignFormState, v: string) { setF((p) => ({ ...p, [k]: v })); }

  const createMut = useMutation({
    mutationFn: () => createAssignment(pos.id, {
      symbol: pos.symbol,
      shares_acquired: parseInt(f.shares_acquired),
      acquisition_price: parseFloat(f.acquisition_price),
      net_option_premium: parseFloat(f.net_option_premium) || 0,
      notes: f.notes || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assignment", pos.id] }); setEditing(false); },
    onError: (e: Error) => setErr(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => updateAssignment(asgn!.id, {
      shares_acquired: parseInt(f.shares_acquired),
      acquisition_price: parseFloat(f.acquisition_price),
      net_option_premium: parseFloat(f.net_option_premium) || 0,
      notes: f.notes || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assignment", pos.id] }); setEditing(false); },
    onError: (e: Error) => setErr(e.message),
  });

  if (isLoading) return <div className="text-xs text-foreground/50 py-2">Loading assignment…</div>;

  if (!asgn && !editing) {
    return (
      <button
        onClick={() => {
          setF({ shares_acquired: "100", acquisition_price: String(pos.strike), net_option_premium: String(Math.abs(pos.net_premium ?? 0)), notes: "" });
          setEditing(true);
        }}
        className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 font-semibold hover:bg-yellow-100 transition"
      >
        + Log Stock Assignment
      </button>
    );
  }

  if (editing) {
    const fld = (label: string, el: React.ReactNode) => (
      <div><label className="text-xs text-foreground/70 block mb-1">{label}</label>{el}</div>
    );
    return (
      <div className="mt-3 bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-3">Stock Assignment — {pos.symbol}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          {fld("Shares Acquired", <input type="number" min="1" value={f.shares_acquired} onChange={(e) => set("shares_acquired", e.target.value)} className={inp} />)}
          {fld("Acquisition Price ($)", <input type="number" step="0.01" value={f.acquisition_price} onChange={(e) => set("acquisition_price", e.target.value)} className={inp} />)}
          {fld("Net Option Premium ($)", <input type="number" step="0.01" value={f.net_option_premium} onChange={(e) => set("net_option_premium", e.target.value)} className={inp} />)}
        </div>
        {fld("Notes", <input value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="optional" className={`${inp} mb-3`} />)}
        {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => asgn ? updateMut.mutate() : createMut.mutate()}
            disabled={createMut.isPending || updateMut.isPending}
            className="px-4 py-2 rounded-xl bg-yellow-500 text-white text-xs font-bold hover:bg-yellow-600 disabled:opacity-50 transition"
          >
            {createMut.isPending || updateMut.isPending ? "Saving…" : "Save Assignment"}
          </button>
          <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs text-foreground hover:bg-[var(--surface-2)] transition">Cancel</button>
        </div>
      </div>
    );
  }

  const a = asgn!;
  const downPct = a.weighted_avg_cost > 0 ? ((a.downside_basis - a.weighted_avg_cost) / a.weighted_avg_cost * 100) : 0;
  const upPct   = a.weighted_avg_cost > 0 ? ((a.upside_basis   - a.weighted_avg_cost) / a.weighted_avg_cost * 100) : 0;

  return (
    <div className="mt-3 bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
          Stock Assignment — {a.symbol} · {a.total_shares} shares
        </p>
        <button
          onClick={() => { setF({ shares_acquired: String(a.shares_acquired), acquisition_price: String(a.acquisition_price), net_option_premium: String(a.net_option_premium), notes: a.notes ?? "" }); setEditing(true); }}
          className="text-[10px] px-2 py-1 rounded-lg border border-yellow-300 dark:border-yellow-700 text-yellow-600 hover:bg-yellow-100 transition"
        >
          Edit
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-[var(--surface)] rounded-lg p-2">
          <p className="text-foreground/60 mb-0.5">Avg Cost</p>
          <p className="font-bold text-foreground">${a.weighted_avg_cost.toFixed(2)}</p>
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-2">
          <p className="text-foreground/60 mb-0.5">Total Cost</p>
          <p className="font-bold text-foreground">${a.total_cost.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
          <p className="text-red-500/70 mb-0.5">Downside BE</p>
          <p className="font-bold text-red-500">${a.downside_basis.toFixed(2)} <span className="text-[9px] font-normal">({downPct.toFixed(1)}%)</span></p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
          <p className="text-green-600/70 mb-0.5">Upside BE</p>
          <p className="font-bold text-green-600">${a.upside_basis.toFixed(2)} <span className="text-[9px] font-normal">({upPct.toFixed(1)}%)</span></p>
        </div>
      </div>
    </div>
  );
}
