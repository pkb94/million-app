"use client";
import { useMemo } from "react";
import { BudgetEntry } from "@/lib/api";
import { SHORT_MONTHS, fmt, computeMonthStats } from "./BudgetHelpers";

export function AnnualSummary({ entries, year }: { entries: BudgetEntry[]; year: number }) {
  const rows = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { month: SHORT_MONTHS[i], key, ...computeMonthStats(entries, key) };
  }), [entries, year]);

  const totals = rows.reduce(
    (acc, r) => ({ income: acc.income + r.income, expense: acc.expense + r.expense, net: acc.net + r.net }),
    { income: 0, expense: 0, net: 0 },
  );
  const avgRate = totals.income > 0 ? Math.round((totals.net / totals.income) * 100) : 0;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]/40">
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">{year} Annual Summary</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] font-semibold text-foreground/40 uppercase tracking-wider border-b border-[var(--border)]">
              <th className="px-3 py-2 text-left">Month</th>
              <th className="px-3 py-2 text-right">Income</th>
              <th className="px-3 py-2 text-right">Expenses</th>
              <th className="px-3 py-2 text-right">Net</th>
              <th className="px-3 py-2 text-left w-[140px]">Savings Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rate = r.income > 0 ? Math.round((r.net / r.income) * 100) : 0;
              const color = rate < 10 ? "bg-red-500" : rate < 20 ? "bg-amber-400" : "bg-emerald-500";
              const empty = r.income === 0 && r.expense === 0;
              return (
                <tr key={r.key} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors">
                  <td className="px-3 py-2 font-medium text-foreground/70">{r.month}</td>
                  <td className="px-3 py-2 text-right text-emerald-400 font-semibold">{empty ? "—" : fmt(r.income)}</td>
                  <td className="px-3 py-2 text-right text-red-400 font-semibold">{empty ? "—" : fmt(r.expense)}</td>
                  <td className={"px-3 py-2 text-right font-bold " + (r.net >= 0 ? "text-emerald-400" : "text-red-400")}>{empty ? "—" : fmt(r.net)}</td>
                  <td className="px-3 py-2">
                    {empty ? <span className="text-foreground/30">—</span> : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                          <div className={"h-full rounded-full " + color} style={{ width: Math.min(Math.max(rate, 0), 100) + "%" }} />
                        </div>
                        <span className="text-[11px] text-foreground/50 w-8 text-right">{rate}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-2)]/40 font-bold">
              <td className="px-3 py-2 text-foreground/60 text-xs uppercase">Total</td>
              <td className="px-3 py-2 text-right text-emerald-400">{fmt(totals.income)}</td>
              <td className="px-3 py-2 text-right text-red-400">{fmt(totals.expense)}</td>
              <td className={"px-3 py-2 text-right " + (totals.net >= 0 ? "text-emerald-400" : "text-red-400")}>{fmt(totals.net)}</td>
              <td className="px-3 py-2 text-[11px] text-foreground/50">Avg {avgRate}% saved</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
