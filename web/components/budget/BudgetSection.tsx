"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveBudget, updateBudget, deleteBudget, saveBudgetOverride, deleteBudgetOverride,
  BudgetEntry, BudgetEntryType, BudgetRecurrence, BudgetOverride,
} from "@/lib/api";
import { Plus, Check, X, Trash2, PencilLine } from "lucide-react";
import {
  CATEGORIES, RECURRENCE_LABEL, RECURRENCE_MONTHS,
  fmt, DraftRow, blankDraft, cellCls, selCls,
} from "./BudgetHelpers";

// ── EditableRow ───────────────────────────────────────────────────────────────

export function EditableRow({
  draft, isRecurring, onChange, onSave, onCancel, saving,
}: {
  draft: DraftRow;
  isRecurring: boolean;
  onChange: (d: DraftRow) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const firstRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof DraftRow, v: string) => onChange({ ...draft, [k]: v });

  useEffect(() => { firstRef.current?.focus(); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter")  onSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <tr className="bg-blue-500/5 border-b border-blue-500/20" onKeyDown={onKey}>
      <td className="px-2 py-1.5 w-[115px]">
        <input
          ref={firstRef}
          type="date" value={draft.date}
          onChange={(e) => set("date", e.target.value)}
          className={cellCls + " w-[105px]"}
        />
      </td>
      <td className="px-2 py-1.5">
        <select value={draft.category} onChange={(e) => set("category", e.target.value)} className={selCls}>
          <option value="">— category —</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </td>
      {!isRecurring && (
        <td className="px-2 py-1.5">
          <input
            value={draft.merchant}
            onChange={(e) => set("merchant", e.target.value)}
            placeholder="Merchant / Payee"
            className={cellCls}
          />
        </td>
      )}
      <td className="px-2 py-1.5 w-[110px]">
        <select value={draft.type} onChange={(e) => set("type", e.target.value as DraftRow["type"])} className={selCls}>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
          <option value="ASSET">Asset</option>
        </select>
      </td>
      {isRecurring && (
        <td className="px-2 py-1.5 w-[120px]">
          <select
            value={draft.recurrence}
            onChange={(e) => set("recurrence", e.target.value as BudgetRecurrence)}
            className={selCls}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="SEMI_ANNUAL">Every 6 mo</option>
            <option value="ANNUAL">Yearly</option>
          </select>
        </td>
      )}
      {isRecurring && (
        <td className="px-2 py-1.5 w-[180px]">
          {(() => {
            const [auY, auM] = draft.active_until ? draft.active_until.split("-") : ["", ""];
            const setAU = (y: string, m: string) => set("active_until", y && m ? `${y}-${m}` : "");
            const curYear = new Date().getFullYear();
            const years = Array.from({ length: 10 }, (_, i) => String(curYear + i));
            const months: [string, string][] = [
              ["01","Jan"],["02","Feb"],["03","Mar"],["04","Apr"],
              ["05","May"],["06","Jun"],["07","Jul"],["08","Aug"],
              ["09","Sep"],["10","Oct"],["11","Nov"],["12","Dec"],
            ];
            return (
              <div className="flex gap-1">
                <select
                  value={auM}
                  onChange={(e) => setAU(auY || String(curYear), e.target.value)}
                  className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-xs text-foreground px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Mo</option>
                  {months.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select
                  value={auY}
                  onChange={(e) => setAU(e.target.value, auM || "12")}
                  className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-xs text-foreground px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Yr</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                {draft.active_until && (
                  <button
                    type="button"
                    onClick={() => set("active_until", "")}
                    title="Clear (set to ongoing)"
                    className="text-foreground/30 hover:text-red-400 px-0.5 text-xs"
                  >✕</button>
                )}
              </div>
            );
          })()}
        </td>
      )}
      <td className="px-2 py-1.5 w-[120px]">
        <input
          type="number" step="0.01" min="0"
          value={draft.amount}
          onChange={(e) => set("amount", e.target.value)}
          placeholder="0.00"
          className={cellCls + " text-right"}
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Note (optional)"
          className={cellCls}
        />
      </td>
      <td className="px-2 py-1.5 w-[70px]">
        <div className="flex items-center gap-1">
          <button
            onClick={onSave}
            disabled={saving || !draft.category || !draft.amount}
            title="Save (Enter)"
            className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/40 disabled:opacity-30 transition"
          >
            {saving ? <span className="text-[10px]">...</span> : <Check size={13} />}
          </button>
          <button
            onClick={onCancel}
            title="Cancel (Esc)"
            className="p-1.5 rounded-lg bg-[var(--surface-2)] text-foreground/50 hover:bg-[var(--border)] transition"
          >
            <X size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── ReadRow ───────────────────────────────────────────────────────────────────

export function ReadRow({
  entry, displayAmount, isRecurring, onEdit, override, onResetOverride,
}: {
  entry: BudgetEntry;
  displayAmount: number;
  isRecurring: boolean;
  onEdit: () => void;
  override?: BudgetOverride;
  onResetOverride?: () => void;
}) {
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = useState(false);
  const del = useMutation({
    mutationFn: () => deleteBudget(entry.id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget"] }),
  });

  const typeUp = entry.type?.toUpperCase();
  const isExpense = typeUp === "EXPENSE";
  const isIncome  = typeUp === "INCOME";
  const amtCls = isExpense ? "text-red-400" : isIncome ? "text-emerald-400" : "text-blue-400";

  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors group">
      <td className="px-3 py-2.5 text-xs text-foreground/50 whitespace-nowrap">
        {entry.date.slice(0, 10)}
      </td>
      <td className="px-3 py-2.5 text-sm font-medium text-foreground">
        {entry.category || "---"}
      </td>
      {!isRecurring && (
        <td className="px-3 py-2.5 text-sm text-foreground/70">
          {entry.merchant ? (
            <span className="inline-flex items-center gap-1 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-full px-2 py-0.5">
              {entry.merchant}
            </span>
          ) : (
            <span className="text-foreground/25 text-xs">—</span>
          )}
        </td>
      )}
      <td className="px-3 py-2.5">
        <span className={"inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full " + (
          isExpense ? "bg-red-500/15 text-red-400"
          : isIncome ? "bg-emerald-500/15 text-emerald-400"
          : "bg-blue-500/15 text-blue-400"
        )}>
          {entry.type}
        </span>
      </td>
      {isRecurring && (
        <td className="px-3 py-2.5 text-xs text-foreground/50">
          {RECURRENCE_LABEL[(entry.recurrence ?? "ANNUAL") as BudgetRecurrence]}
        </td>
      )}
      {isRecurring && (
        <td className="px-3 py-2.5 text-xs">
          {entry.active_until ? (
            <span className="text-amber-400/80">{entry.active_until}</span>
          ) : (
            <span className="text-foreground/25">∞ ongoing</span>
          )}
        </td>
      )}
      <td className={"px-3 py-2.5 text-sm font-bold text-right whitespace-nowrap " + amtCls}>
        {fmt(displayAmount)}
        {isRecurring && override && (
          <span className="ml-1 text-[10px] font-normal text-blue-400" title={`Override active (base: ${fmt(entry.amount)})`}>
            ✎
          </span>
        )}
        {isRecurring && !override && displayAmount !== entry.amount && (
          <span className="ml-1 text-[10px] font-normal text-foreground/30">
            ({fmt(entry.amount)})
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-foreground/40 max-w-[160px] truncate">
        {override?.description ?? entry.description ?? ""}
      </td>
      <td className="px-3 py-2.5 w-[110px]" onClick={(e) => e.stopPropagation()}>
        {confirmDel ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => del.mutate()}
              disabled={del.isPending}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {del.isPending ? "..." : "Yes"}
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-[var(--surface-2)] text-foreground/70"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              title={isRecurring ? "Override amount for this month" : "Edit"}
              className="p-1.5 rounded-lg text-foreground/40 hover:text-blue-400 hover:bg-blue-500/10 transition"
            >
              <PencilLine size={13} />
            </button>
            {isRecurring && override && onResetOverride && (
              <button
                onClick={onResetOverride}
                title="Reset to base amount"
                className="p-1.5 rounded-lg text-foreground/40 hover:text-amber-400 hover:bg-amber-500/10 transition"
              >
                <X size={11} />
              </button>
            )}
            <button
              onClick={() => setConfirmDel(true)}
              title="Delete"
              className="p-1.5 rounded-lg text-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function Section({
  title, icon, accentCls, rows, isRecurring, currentMonth, overrides, typeFilter,
}: {
  title: string;
  icon: React.ReactNode;
  accentCls: string;
  rows: { entry: BudgetEntry; displayAmount: number }[];
  isRecurring: boolean;
  currentMonth: string;
  overrides: BudgetOverride[];
  typeFilter?: "INCOME" | "EXPENSE";
}) {
  const qc = useQueryClient();
  const [drafts, setDrafts]       = useState<DraftRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DraftRow | null>(null);

  const overrideMap = useMemo(() => {
    const m: Record<string, BudgetOverride> = {};
    for (const o of overrides) m[`${o.budget_id}:${o.month_key}`] = o;
    return m;
  }, [overrides]);

  const getOverride = (entryId: number) => overrideMap[`${entryId}:${currentMonth}`];

  const mut = useMutation({
    mutationFn: (d: DraftRow) => {
      const body: Omit<BudgetEntry, "id"> = {
        category: d.category,
        type: d.type,
        entry_type: d.entry_type,
        recurrence: d.entry_type === "RECURRING" ? d.recurrence : undefined,
        amount: parseFloat(d.amount),
        date: d.date,
        description: d.description || undefined,
        merchant: d.merchant || undefined,
        active_until: (d.entry_type === "RECURRING" && d.active_until) ? d.active_until : undefined,
      };
      return d.id ? updateBudget(d.id, body) : saveBudget(body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget"] }),
  });

  const overrideMut = useMutation({
    mutationFn: (d: DraftRow) =>
      saveBudgetOverride({
        budget_id: d.id!,
        month_key: currentMonth,
        amount: parseFloat(d.amount),
        description: d.description || null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget-overrides"] }),
  });

  const resetOverrideMut = useMutation({
    mutationFn: (overrideId: number) => deleteBudgetOverride(overrideId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget-overrides"] }),
  });

  const addRow = () => {
    const draft = blankDraft(currentMonth, isRecurring);
    if (typeFilter) draft.type = typeFilter;
    setDrafts((p) => [...p, draft]);
  };

  const saveDraft = async (idx: number) => {
    const d = drafts[idx];
    if (!d.category || !d.amount) return;
    await mut.mutateAsync(d);
    setDrafts((p) => p.filter((_, i) => i !== idx));
  };

  const startEdit = (entry: BudgetEntry) => {
    setEditingId(entry.id!);
    setEditDraft({
      id: entry.id,
      category: entry.category,
      type: (entry.type?.toUpperCase() as DraftRow["type"]) ?? "EXPENSE",
      entry_type: (entry.entry_type ?? (isRecurring ? "RECURRING" : "FLOATING")) as BudgetEntryType,
      recurrence: (entry.recurrence ?? "MONTHLY") as BudgetRecurrence,
      amount: String(entry.amount),
      date: entry.date.slice(0, 10),
      description: entry.description ?? "",
      merchant: entry.merchant ?? "",
      active_until: entry.active_until ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editDraft?.category || !editDraft.amount) return;
    await mut.mutateAsync(editDraft);
    setEditingId(null);
    setEditDraft(null);
  };

  const effectiveRows = rows.map(({ entry, displayAmount }) => {
    const ov = isRecurring ? getOverride(entry.id!) : undefined;
    return { entry, displayAmount: ov ? ov.amount : displayAmount, override: ov };
  });

  const total = effectiveRows.reduce((s, r) => s + r.displayAmount, 0);
  const colSpan = isRecurring ? 7 : 7;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]/40">
        <div className="flex items-center gap-2">
          <span className={accentCls}>{icon}</span>
          <span className="font-bold text-sm text-foreground">{title}</span>
          <span className="text-xs bg-[var(--surface-2)] text-foreground/50 px-2 py-0.5 rounded-full border border-[var(--border)]">
            {rows.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={"text-sm font-bold " + accentCls}>{fmt(total)}</span>
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
          >
            <Plus size={12} /> Add row
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] font-semibold text-foreground/40 uppercase tracking-wider border-b border-[var(--border)]">
              <th className="px-3 py-2 text-left w-[115px]">Date</th>
              <th className="px-3 py-2 text-left">Category</th>
              {!isRecurring && <th className="px-3 py-2 text-left w-[140px]">Merchant</th>}
              <th className="px-3 py-2 text-left w-[110px]">Type</th>
              {isRecurring && <th className="px-3 py-2 text-left w-[120px]">Frequency</th>}
              {isRecurring && <th className="px-3 py-2 text-left w-[110px]" title="Leave blank for indefinite">Ends</th>}
              <th className="px-3 py-2 text-right w-[120px]">Amount</th>
              <th className="px-3 py-2 text-left">Note</th>
              <th className="px-3 py-2 w-[110px]"></th>
            </tr>
          </thead>
          <tbody>
            {effectiveRows.map(({ entry, displayAmount, override }) =>
              editingId === entry.id && editDraft ? (
                <EditableRow
                  key={entry.id}
                  draft={editDraft}
                  isRecurring={isRecurring}
                  onChange={setEditDraft}
                  onSave={saveEdit}
                  onCancel={() => { setEditingId(null); setEditDraft(null); }}
                  saving={mut.isPending || overrideMut.isPending}
                />
              ) : (
                <ReadRow
                  key={entry.id}
                  entry={entry}
                  displayAmount={displayAmount}
                  isRecurring={isRecurring}
                  onEdit={() => startEdit(entry)}
                  override={override}
                  onResetOverride={override?.id ? () => resetOverrideMut.mutate(override.id!) : undefined}
                />
              )
            )}

            {drafts.map((d, idx) => (
              <EditableRow
                key={"new-" + idx}
                draft={d}
                isRecurring={isRecurring}
                onChange={(nd) => setDrafts((p) => p.map((r, i) => i === idx ? nd : r))}
                onSave={() => saveDraft(idx)}
                onCancel={() => setDrafts((p) => p.filter((_, i) => i !== idx))}
                saving={mut.isPending}
              />
            ))}

            {rows.length === 0 && drafts.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-foreground/30">
                  No entries yet — click <strong className="text-foreground/50">Add row</strong> to get started
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
