import { BudgetEntry, BudgetRecurrence } from "@/lib/api";

// ── Palette ───────────────────────────────────────────────────────────────────

export const PIE_COLORS = [
  "#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444",
  "#06b6d4","#84cc16","#f97316","#ec4899","#14b8a6",
  "#6366f1","#f43f5e","#22d3ee","#a3e635","#fb923c",
];

// ── Constants ─────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  "Groceries","Personal Loan","Car Payment","Communication",
  "Personal Care","Gas","Utilities","Shopping","Housing",
  "Entertainment","Subscriptions","Travel","Gifts","Other",
];

export const RECURRENCE_MONTHS: Record<BudgetRecurrence, number> = {
  MONTHLY: 1, SEMI_ANNUAL: 6, ANNUAL: 12,
};

export const RECURRENCE_LABEL: Record<BudgetRecurrence, string> = {
  MONTHLY: "Monthly", SEMI_ANNUAL: "Every 6 mo", ANNUAL: "Yearly",
};

export const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Formatters ────────────────────────────────────────────────────────────────

export const fmtK = (v: number) => v >= 1000 ? "$" + (v / 1000).toFixed(1) + "k" : "$" + Math.round(v);

export const fmt = (v: number) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmt$(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Date helpers ──────────────────────────────────────────────────────────────

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });
}

// ── Budget entry helpers ──────────────────────────────────────────────────────

export function proratedMonthly(entry: BudgetEntry): number {
  const months = RECURRENCE_MONTHS[(entry.recurrence ?? "ANNUAL") as BudgetRecurrence];
  return entry.amount / months;
}

export function recurringAppliesToMonth(entry: BudgetEntry, targetKey: string): boolean {
  const period = RECURRENCE_MONTHS[(entry.recurrence ?? "ANNUAL") as BudgetRecurrence];
  const base = new Date(entry.date.slice(0, 10) + "T00:00:00");
  const [ty, tm] = targetKey.split("-").map(Number);
  const diff = (ty - base.getFullYear()) * 12 + (tm - (base.getMonth() + 1));
  if (diff < 0) return false;
  if (diff % period !== 0) return false;
  if (entry.active_until) {
    const [ey, em] = entry.active_until.split("-").map(Number);
    if (ty > ey || (ty === ey && tm > em)) return false;
  }
  return true;
}

// ── Draft row type ────────────────────────────────────────────────────────────

export interface DraftRow {
  id?: number;
  category: string;
  type: "EXPENSE" | "INCOME" | "ASSET";
  entry_type: import("@/lib/api").BudgetEntryType;
  recurrence: BudgetRecurrence;
  amount: string;
  date: string;
  description: string;
  merchant: string;
  active_until: string;
}

export function blankDraft(month: string, isRecurring: boolean): DraftRow {
  return {
    category: "",
    type: "EXPENSE",
    entry_type: isRecurring ? "RECURRING" : "FLOATING",
    recurrence: "MONTHLY",
    amount: "",
    date: `${month}-01`,
    description: "",
    merchant: "",
    active_until: "",
  };
}

// ── Shared input styles ───────────────────────────────────────────────────────

export const cellCls = "w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/25 focus:bg-blue-500/10 rounded px-1 py-0.5";
export const selCls  = "w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-foreground px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500";

// ── computeMonthStats ─────────────────────────────────────────────────────────

export function computeMonthStats(entries: BudgetEntry[], key: string) {
  let income = 0, expense = 0;
  for (const e of entries) {
    const et = (e.entry_type ?? "FLOATING").toUpperCase();
    const isIncome = e.type?.toUpperCase() === "INCOME";
    const isExpense = e.type?.toUpperCase() === "EXPENSE";
    if (et !== "RECURRING") {
      if (e.date.slice(0, 7) === key) {
        if (isIncome)  income  += e.amount;
        if (isExpense) expense += e.amount;
      }
    } else {
      if (recurringAppliesToMonth(e, key)) {
        const m = RECURRENCE_MONTHS[(e.recurrence ?? "ANNUAL") as BudgetRecurrence];
        const prorated = e.amount / m;
        if (isIncome)  income  += prorated;
        if (isExpense) expense += prorated;
      }
    }
  }
  return { income, expense, net: income - expense };
}
