"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCCWeeks, saveCCWeek, updateCCWeek, deleteCCWeek, CreditCardWeek,
} from "@/lib/api";
import { Plus, Check, X, Trash2, PencilLine, CreditCard } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { fmt$ } from "./BudgetHelpers";
import { cellCls } from "./BudgetHelpers";

// ── Week helpers ──────────────────────────────────────────────────────────────

function getWeeksForMonth(yearMonth: string): { sunday: Date; saturday: Date; isoSunday: string }[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay  = new Date(y, m, 0);
  const startSun = new Date(firstDay);
  startSun.setDate(firstDay.getDate() - firstDay.getDay());
  const weeks: { sunday: Date; saturday: Date; isoSunday: string }[] = [];
  const cur = new Date(startSun);
  while (cur <= lastDay) {
    const sun = new Date(cur);
    const sat = new Date(cur);
    sat.setDate(sat.getDate() + 6);
    weeks.push({ sunday: sun, saturday: sat, isoSunday: sun.toISOString().slice(0, 10) });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function fmtWeekLabel(sun: Date, sat: Date): string {
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return sun.toLocaleDateString("en-US", o) + " – " + sat.toLocaleDateString("en-US", o);
}

// ── Draft type ────────────────────────────────────────────────────────────────

interface CCDraft {
  id?: number;
  card_name: string;
  date: string;
  balance: string;
  paid_amount: string;
  note: string;
}

function blankCCDraft(month: string): CCDraft {
  return { card_name: "", date: `${month}-01`, balance: "", paid_amount: "", note: "" };
}

// ── CCEditRow ─────────────────────────────────────────────────────────────────

function CCEditRow({
  draft, onChange, onSave, onCancel, datalistId, isSaving,
}: {
  draft: CCDraft;
  onChange: (d: CCDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  datalistId: string;
  isSaving: boolean;
}) {
  const set = (k: keyof CCDraft, v: string) => onChange({ ...draft, [k]: v });
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSave();
    if (e.key === "Escape") onCancel();
  };
  return (
    <tr className="bg-blue-500/5 border-b border-blue-500/20" onKeyDown={onKey}>
      <td className="px-2 py-1.5">
        <input type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} className={cellCls + " w-[105px]"} />
      </td>
      <td className="px-2 py-1.5">
        <input type="text" list={datalistId} value={draft.card_name} placeholder="Card name"
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          onChange={(e) => set("card_name", e.target.value)} className={cellCls} />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" step="0.01" min="0" value={draft.balance} placeholder="0.00"
          onChange={(e) => set("balance", e.target.value)} className={cellCls + " text-right"} />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" step="0.01" min="0" value={draft.paid_amount} placeholder="0.00"
          onChange={(e) => set("paid_amount", e.target.value)} className={cellCls + " text-right"} />
      </td>
      <td className="px-2 py-1.5">
        <input type="text" value={draft.note} placeholder="Note (optional)"
          onChange={(e) => set("note", e.target.value)} className={cellCls} />
      </td>
      <td className="px-2 py-1.5 w-[70px]">
        <div className="flex items-center gap-1">
          <button onClick={onSave} disabled={isSaving || !draft.balance}
            className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/40 disabled:opacity-30 transition">
            <Check size={13} />
          </button>
          <button onClick={onCancel}
            className="p-1.5 rounded-lg bg-[var(--surface-2)] text-foreground/50 hover:bg-[var(--border)] transition">
            <X size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── CCReadRow ─────────────────────────────────────────────────────────────────

function CCReadRow({ row, onEdit, onDelete }: {
  row: CreditCardWeek;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors group">
      <td className="px-3 py-2.5 text-xs text-foreground/50 whitespace-nowrap">{row.week_start.slice(0, 10)}</td>
      <td className="px-3 py-2.5 text-sm">
        {row.card_name ? (
          <span className="inline-flex items-center gap-1 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-full px-2 py-0.5">
            {row.card_name}
          </span>
        ) : <span className="text-foreground/25 text-xs">—</span>}
      </td>
      <td className="px-3 py-2.5 text-sm font-bold text-right text-rose-400">{fmt$(row.balance)}</td>
      <td className="px-3 py-2.5 text-sm font-bold text-right text-emerald-400">
        {row.paid_amount != null ? fmt$(row.paid_amount) : <span className="text-foreground/25">—</span>}
      </td>
      <td className="px-3 py-2.5 text-xs text-foreground/40 max-w-[160px] truncate">{row.note || ""}</td>
      <td className="px-3 py-2.5 w-[100px]" onClick={(e) => e.stopPropagation()}>
        {confirmDel ? (
          <div className="flex items-center gap-1">
            <button onClick={onDelete}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-red-600 text-white hover:bg-red-700">Yes</button>
            <button onClick={() => setConfirmDel(false)}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-[var(--surface-2)] text-foreground/70">No</button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={onEdit}
              className="p-1.5 rounded-lg text-foreground/40 hover:text-blue-400 hover:bg-blue-500/10 transition">
              <PencilLine size={13} />
            </button>
            <button onClick={() => setConfirmDel(true)}
              className="p-1.5 rounded-lg text-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

export function StatCard({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 sm:p-4">
      <p className="text-[10px] sm:text-[11px] font-semibold text-foreground/50 uppercase tracking-wide mb-1">{label}</p>
      <p className={"text-xl sm:text-2xl font-black " + cls}>{value}</p>
    </div>
  );
}

// ── CCSection ─────────────────────────────────────────────────────────────────

export function CCSection({
  currentMonth,
  title = "Credit Cards",
  accentColor = "text-blue-400",
  cardFilter,
  defaultCard,
  datalistId = "cc-card-names",
  fixedWeeks = false,
}: {
  currentMonth: string;
  title?: string;
  accentColor?: string;
  cardFilter?: (r: CreditCardWeek) => boolean;
  defaultCard?: string;
  datalistId?: string;
  fixedWeeks?: boolean;
}) {
  const qc = useQueryClient();
  const { data: allRows = [], isLoading } = useQuery<CreditCardWeek[]>({
    queryKey: ["cc-weeks"],
    queryFn: fetchCCWeeks,
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    const monthRows = allRows.filter((r) => r.week_start.slice(0, 7) === currentMonth);
    return cardFilter ? monthRows.filter(cardFilter) : monthRows;
  }, [allRows, currentMonth, cardFilter]);

  const weekSlotList = useMemo(
    () => fixedWeeks ? getWeeksForMonth(currentMonth) : [],
    [fixedWeeks, currentMonth],
  );
  const rowByDate = useMemo(() => {
    const m: Record<string, CreditCardWeek> = {};
    for (const r of rows) m[r.week_start.slice(0, 10)] = r;
    return m;
  }, [rows]);
  const [weekEdits, setWeekEdits] = useState<Record<string, { balance: string; paid_amount: string; note: string }>>({});

  const [drafts, setDrafts] = useState<CCDraft[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<CCDraft | null>(null);

  const saveMut = useMutation<void | { id: number }, Error, CCDraft>({
    mutationFn: (d: CCDraft) => {
      const body: Omit<CreditCardWeek, "id"> = {
        week_start: d.date,
        card_name: d.card_name || null,
        balance: parseFloat(d.balance) || 0,
        paid_amount: d.paid_amount !== "" ? parseFloat(d.paid_amount) : null,
        squared_off: false,
        note: d.note || "",
      };
      return d.id ? updateCCWeek(d.id, body) : saveCCWeek(body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cc-weeks"] }),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => deleteCCWeek(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cc-weeks"] }),
  });

  const addRow = () => setDrafts((p) => [...p, { ...blankCCDraft(currentMonth), card_name: defaultCard ?? "" }]);

  const saveDraft = async (idx: number) => {
    const d = drafts[idx];
    if (!d.balance) return;
    await saveMut.mutateAsync(d);
    setDrafts((p) => p.filter((_, i) => i !== idx));
  };

  const startEdit = (r: CreditCardWeek) => {
    setEditingId(r.id!);
    setEditDraft({
      id: r.id,
      card_name: r.card_name ?? "",
      date: r.week_start.slice(0, 10),
      balance: String(r.balance ?? ""),
      paid_amount: r.paid_amount != null ? String(r.paid_amount) : "",
      note: r.note ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editDraft) return;
    await saveMut.mutateAsync(editDraft);
    setEditingId(null);
    setEditDraft(null);
  };

  const getWeekLocal = (iso: string) =>
    weekEdits[iso] ?? {
      balance: String(rowByDate[iso]?.balance ?? ""),
      paid_amount: rowByDate[iso]?.paid_amount != null ? String(rowByDate[iso]!.paid_amount) : "",
      note: "",
    };

  const commitWeekRow = async (iso: string) => {
    const local = weekEdits[iso];
    if (!local) return;
    const existing = rowByDate[iso];
    const body: Omit<CreditCardWeek, "id"> = {
      week_start: iso,
      card_name: defaultCard ?? null,
      balance: parseFloat(local.balance) || 0,
      paid_amount: local.paid_amount !== "" ? parseFloat(local.paid_amount) : null,
      squared_off: existing?.squared_off ?? false,
      note: local.note || "",
    };
    if (existing?.id) await updateCCWeek(existing.id, body);
    else await saveCCWeek(body);
    qc.invalidateQueries({ queryKey: ["cc-weeks"] });
    setWeekEdits((p) => { const n = { ...p }; delete n[iso]; return n; });
  };

  const cardNames = useMemo(() => {
    const s = new Set<string>();
    for (const r of allRows) if (r.card_name) s.add(r.card_name);
    return Array.from(s).sort();
  }, [allRows]);

  const totalCharged = rows.reduce((s, r) => s + (r.balance ?? 0), 0);
  const totalPaid    = rows.reduce((s, r) => s + (r.paid_amount ?? 0), 0);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]/40">
        <div className="flex items-center gap-2">
          <CreditCard size={14} className={accentColor} />
          <span className="font-bold text-sm text-foreground">{title}</span>
          <span className="text-xs bg-[var(--surface-2)] text-foreground/50 px-2 py-0.5 rounded-full border border-[var(--border)]">
            {rows.length}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {totalCharged > 0 && (
            <div className="flex items-center gap-2 sm:gap-3 text-xs">
              <span className="text-foreground/40">Charged: <span className="font-bold text-rose-400">{fmt$(totalCharged)}</span></span>
              <span className="text-foreground/40">Paid: <span className="font-bold text-emerald-400">{fmt$(totalPaid)}</span></span>
              {totalCharged - totalPaid > 0 && (
                <span className="text-foreground/40">Due: <span className="font-bold text-amber-400">{fmt$(totalCharged - totalPaid)}</span></span>
              )}
            </div>
          )}
          {!fixedWeeks && (
            <button onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition">
              <Plus size={12} /> Add row
            </button>
          )}
        </div>
      </div>

      <datalist id={datalistId}>
        {cardNames.map((c) => <option key={c} value={c} />)}
      </datalist>

      {!fixedWeeks && (
        <div className="overflow-x-auto -mx-px">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-[11px] font-semibold text-foreground/40 uppercase tracking-wider border-b border-[var(--border)]">
                <th className="px-3 py-2 text-left w-[150px]">Date</th>
                <th className="px-3 py-2 text-left w-[160px]">Card Name</th>
                <th className="px-3 py-2 text-right w-[110px]">Amount</th>
                <th className="px-3 py-2 text-right w-[110px]">Paid</th>
                <th className="px-3 py-2 text-left">Note</th>
                <th className="px-3 py-2 w-[70px]"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-foreground/30">Loading…</td></tr>
              ) : (
                <>
                  {rows.map((r) =>
                    editingId === r.id && editDraft ? (
                      <CCEditRow key={r.id} draft={editDraft} onChange={setEditDraft}
                        datalistId={datalistId} isSaving={saveMut.isPending}
                        onSave={saveEdit} onCancel={() => { setEditingId(null); setEditDraft(null); }} />
                    ) : (
                      <CCReadRow key={r.id} row={r}
                        onEdit={() => startEdit(r)}
                        onDelete={() => delMut.mutate(r.id!)} />
                    )
                  )}
                  {drafts.map((d, idx) => (
                    <CCEditRow key={"new-" + idx} draft={d}
                      datalistId={datalistId} isSaving={saveMut.isPending}
                      onChange={(nd) => setDrafts((p) => p.map((x, i) => i === idx ? nd : x))}
                      onSave={() => saveDraft(idx)}
                      onCancel={() => setDrafts((p) => p.filter((_, i) => i !== idx))} />
                  ))}
                  {rows.length === 0 && drafts.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-foreground/30">
                      No entries yet — click <strong className="text-foreground/50">Add row</strong> to get started
                    </td></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {fixedWeeks && (
        <div className="flex flex-col md:flex-row border-t border-[var(--border)]">

          {/* Left: week cards */}
          <div className="md:w-[320px] lg:w-[360px] shrink-0 border-b md:border-b-0 md:border-r border-[var(--border)] flex flex-col">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_80px_32px] gap-1 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/60">
              <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider">Week</span>
              <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider text-right">Charged</span>
              <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider text-right">Paid</span>
              <span />
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center py-8 text-xs text-foreground/30">Loading…</div>
            ) : (
              <div className="flex flex-col divide-y divide-[var(--border)]">
                {weekSlotList.map(({ sunday, saturday, isoSunday }) => {
                  const existing = rowByDate[isoSunday];
                  const local = getWeekLocal(isoSunday);
                  const isDirty = !!weekEdits[isoSunday];
                  const charged = parseFloat(local.balance) || 0;
                  const paid    = parseFloat(local.paid_amount) || 0;
                  const pct     = charged > 0 ? Math.min(100, (paid / charged) * 100) : 0;
                  const isPaid  = charged > 0 && paid >= charged;
                  const isPartial = charged > 0 && paid > 0 && paid < charged;
                  const isEmpty = charged === 0;

                  return (
                    <div key={isoSunday}
                      className={"group px-3 py-2 transition-colors hover:bg-[var(--surface-2)] " + (isDirty ? "bg-blue-500/5" : "")}
                    >
                      {/* Row: label + inputs + action */}
                      <div className="grid grid-cols-[1fr_80px_80px_32px] gap-1 items-center">
                        {/* Week label + status pill */}
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-xs font-medium text-foreground/70 whitespace-nowrap truncate">
                            {fmtWeekLabel(sunday, saturday)}
                          </span>
                          {!isEmpty && (
                            <span className={"text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full self-start " + (
                              isPaid    ? "bg-emerald-500/15 text-emerald-400" :
                              isPartial ? "bg-amber-500/15 text-amber-400" :
                                          "bg-rose-500/15 text-rose-400"
                            )}>
                              {isPaid ? "Paid" : isPartial ? "Partial" : "Unpaid"}
                            </span>
                          )}
                        </div>

                        {/* Charged input */}
                        <input
                          type="number" step="0.01" min="0"
                          value={local.balance} placeholder="0.00"
                          onChange={(e) => setWeekEdits((p) => ({ ...p, [isoSunday]: { ...getWeekLocal(isoSunday), balance: e.target.value } }))}
                          onBlur={() => isDirty && commitWeekRow(isoSunday)}
                          onKeyDown={(e) => e.key === "Enter" && commitWeekRow(isoSunday)}
                          className="w-full bg-transparent text-xs text-right text-rose-400 font-semibold tabular-nums outline-none focus:bg-rose-500/10 rounded px-1 py-0.5 placeholder:text-foreground/20"
                        />

                        {/* Paid input */}
                        <input
                          type="number" step="0.01" min="0"
                          value={local.paid_amount} placeholder="0.00"
                          onChange={(e) => setWeekEdits((p) => ({ ...p, [isoSunday]: { ...getWeekLocal(isoSunday), paid_amount: e.target.value } }))}
                          onBlur={() => isDirty && commitWeekRow(isoSunday)}
                          onKeyDown={(e) => e.key === "Enter" && commitWeekRow(isoSunday)}
                          className="w-full bg-transparent text-xs text-right text-emerald-400 font-semibold tabular-nums outline-none focus:bg-emerald-500/10 rounded px-1 py-0.5 placeholder:text-foreground/20"
                        />

                        {/* Action button */}
                        <div className="flex justify-center">
                          {isDirty ? (
                            <button onClick={() => commitWeekRow(isoSunday)}
                              className="p-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/40 transition">
                              <Check size={11} />
                            </button>
                          ) : existing?.id ? (
                            <button onClick={() => delMut.mutate(existing.id!)}
                              className="p-1 rounded text-foreground/20 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100">
                              <Trash2 size={11} />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Mini progress bar (only when there's data) */}
                      {!isEmpty && (
                        <div className="mt-1.5 h-1 rounded-full bg-foreground/10 overflow-hidden">
                          <div
                            className={"h-full rounded-full transition-all duration-300 " + (isPaid ? "bg-emerald-500" : isPartial ? "bg-amber-400" : "bg-rose-500")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: stats + progress + chart */}
          {totalCharged > 0 ? (
            <div className="flex-1 min-w-0 flex flex-col divide-y divide-[var(--border)]">

              {/* 4 stat tiles — flush grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[var(--border)]">
                {[
                  { label: "Total Charged", value: fmt$(totalCharged), cls: "text-rose-400" },
                  { label: "Total Paid",    value: fmt$(totalPaid),    cls: "text-emerald-400" },
                  { label: "Net Unpaid",    value: fmt$(Math.max(0, totalCharged - totalPaid)),
                    cls: totalCharged - totalPaid > 0 ? "text-amber-400" : "text-emerald-400" },
                  { label: "Pay Rate",
                    value: (Math.min(100, (totalPaid / totalCharged) * 100)).toFixed(1) + "%",
                    cls: totalPaid >= totalCharged ? "text-emerald-400" : totalPaid / totalCharged >= 0.5 ? "text-amber-400" : "text-rose-400" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="bg-[var(--surface)] px-4 py-3 flex flex-col gap-0.5">
                    <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wide">{label}</p>
                    <p className={"text-xl font-black tabular-nums " + cls}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Pay coverage bar */}
              {(() => {
                const rate = Math.min(100, (totalPaid / totalCharged) * 100);
                return (
                  <div className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wide shrink-0">Pay Coverage</span>
                    <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                      <div className={"h-full rounded-full transition-all duration-500 " + (rate >= 100 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-400" : "bg-rose-500")}
                        style={{ width: `${rate}%` }} />
                    </div>
                    <span className={"text-xs font-bold tabular-nums " + (rate >= 100 ? "text-emerald-400" : rate >= 50 ? "text-amber-400" : "text-rose-400")}>
                      {rate.toFixed(1)}%
                    </span>
                  </div>
                );
              })()}

              {/* Chart */}
              <div className="flex-1 px-3 pt-3 pb-2">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart
                    data={weekSlotList.map(({ sunday, saturday, isoSunday }) => ({
                      week: fmtWeekLabel(sunday, saturday).replace(/ – /g, "–"),
                      Charged: rowByDate[isoSunday]?.balance ?? 0,
                      Paid: rowByDate[isoSunday]?.paid_amount ?? 0,
                    }))}
                    barCategoryGap="30%" margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="week" tick={{ fill: "var(--foreground)", opacity: 0.4, fontSize: 8 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "var(--foreground)", opacity: 0.4, fontSize: 8 }} tickLine={false} axisLine={false} tickFormatter={(v) => "$" + v} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 11 }}
                      formatter={(v: number | undefined) => "$" + (v ?? 0).toFixed(2)} />
                    <Legend wrapperStyle={{ fontSize: 10, color: "var(--foreground)", opacity: 0.5 }} />
                    <Bar dataKey="Charged" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Paid" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-foreground/25 py-10">
              Enter amounts to see metrics
            </div>
          )}

        </div>
      )}
    </div>
  );
}
