"use client";
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area, ReferenceLine,
} from "recharts";
import { BudgetEntry, BudgetRecurrence } from "@/lib/api";
import {
  SHORT_MONTHS, PIE_COLORS, fmtK, fmt, computeMonthStats,
  recurringAppliesToMonth, RECURRENCE_MONTHS,
} from "./BudgetHelpers";

// ── TrendChart ────────────────────────────────────────────────────────────────

export function TrendChart({ entries }: { entries: BudgetEntry[] }) {
  const data = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const { income, expense } = computeMonthStats(entries, key);
      return { month: SHORT_MONTHS[d.getMonth()], Income: Math.round(income), Expenses: Math.round(expense) };
    });
  }, [entries]);

  const hasData = data.some((d) => d.Income > 0 || d.Expenses > 0);

  // Compute net surplus per month for the area fill
  const chartData = data.map((d) => ({ ...d, Net: d.Income - d.Expenses }));

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">12-Month Trend</p>
        <div className="flex items-center gap-3 text-[10px] text-foreground/40">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-1 rounded bg-emerald-500" />Income</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-1 rounded bg-red-500" />Expenses</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-1 rounded bg-blue-400" />Net</span>
        </div>
      </div>
      {!hasData ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-foreground/30">
          No data yet — add entries to see trends
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--foreground)", opacity: 0.5 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "var(--foreground)", opacity: 0.5 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              formatter={(v: unknown, name: string | undefined) => [fmt(Number(v)), name ?? ""]}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" }}
            />
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="Income"   stroke="#10b981" fill="url(#incGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Expenses" stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Net"      stroke="#60a5fa" fill="url(#netGrad)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── SavingsRate ───────────────────────────────────────────────────────────────

export function SavingsRate({ income, net }: { income: number; net: number }) {
  const rate = income > 0 ? Math.round((net / income) * 100) : 0;
  const color = rate < 10 ? "bg-red-500" : rate < 20 ? "bg-amber-400" : "bg-emerald-500";
  const hint  = rate < 10 ? "Below target" : rate < 20 ? "Getting there" : "On track";
  const textColor = rate < 10 ? "text-red-400" : rate < 20 ? "text-amber-400" : "text-emerald-400";
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wide mb-1">Savings Rate</p>
      <p className={"text-2xl font-black " + textColor}>{rate}%</p>
      <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div className={"h-full rounded-full transition-all " + color} style={{ width: Math.min(Math.max(rate, 0), 100) + "%" }} />
      </div>
      <p className="text-[11px] text-foreground/40 mt-1">{hint}</p>
    </div>
  );
}

// ── TopCategoriesBar ────────────────────────────────────────────────────────────

export function TopCategoriesBar({ pieData }: { pieData: { name: string; value: number }[] }) {
  const top = pieData.slice(0, 7);
  const total = top.reduce((s, d) => s + d.value, 0);
  if (top.length === 0) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">Top Spending Categories</p>
      <div className="flex flex-col gap-2">
        {top.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="text-xs text-foreground/70 w-28 truncate shrink-0">{d.name}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: pct + "%", background: PIE_COLORS[i % PIE_COLORS.length] }} />
              </div>
              <span className="text-xs font-semibold text-foreground/70 w-16 text-right shrink-0">{fmt(d.value)}</span>
              <span className="text-[11px] text-foreground/35 w-8 text-right shrink-0">{Math.round(pct)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── IncomeExpenseSplit ──────────────────────────────────────────────────────────

export function IncomeExpenseSplit({
  income, expense, fixedExp, floatExp,
}: { income: number; expense: number; fixedExp: number; floatExp: number }) {
  const data = [
    { name: "Income",   value: Math.round(income),   fill: "#10b981" },
    { name: "Expenses", value: Math.round(expense),  fill: "#ef4444" },
    { name: "Fixed",    value: Math.round(fixedExp), fill: "#8b5cf6" },
    { name: "Variable", value: Math.round(floatExp), fill: "#f59e0b" },
  ];
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">Income vs Expenses</p>
      <div className="flex flex-col gap-3">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="text-xs text-foreground/60 w-16 shrink-0">{d.name}</span>
            <div className="flex-1 h-5 rounded-lg bg-[var(--surface-2)] overflow-hidden">
              <div
                className="h-full rounded-lg flex items-center justify-end pr-2 transition-all"
                style={{ width: Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0) + "%", background: d.fill }}
              >
                {d.value > 0 && <span className="text-[11px] font-bold text-white whitespace-nowrap">{fmtK(d.value)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between">
        <span className="text-xs text-foreground/40">Fixed vs Variable expenses</span>
        <span className="text-xs font-semibold text-foreground/60">
          {expense > 0 ? Math.round((fixedExp / expense) * 100) : 0}% fixed
        </span>
      </div>
    </div>
  );
}

// ── ExpensePieChart ─────────────────────────────────────────────────────────────

export function ExpensePieChart({ pieData }: { pieData: { name: string; value: number }[] }) {
  const total = pieData.reduce((s, d) => s + d.value, 0);
  const top = pieData.slice(0, 8);
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">Expense Mix</p>
      <div className="flex items-center gap-3">
        {/* Donut */}
        <div className="shrink-0" style={{ width: 140, height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={top}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                innerRadius={38}
                outerRadius={62}
                paddingAngle={2}
                strokeWidth={0}
              >
                {top.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: unknown) => [fmt(Number(v)), "Amount"]}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "var(--foreground)",
                }}
                itemStyle={{ color: "var(--foreground)" }}
                labelStyle={{ color: "var(--foreground)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Custom legend */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          {top.map((d, i) => {
            const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
            return (
              <div key={d.name} className="flex items-center gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-[11px] text-foreground/70 truncate flex-1">{d.name}</span>
                <span className="text-[11px] font-semibold text-foreground/80 shrink-0">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── CashFlowWaterfall ─────────────────────────────────────────────────────────

export function CashFlowWaterfall({
  income,
  pieData,
  ccTotal,
}: {
  income: number;
  pieData: { name: string; value: number }[];
  ccTotal: number;
}) {
  const { items, net } = useMemo(() => {
    const items: { name: string; value: number; start: number; isIncome: boolean; isNet: boolean }[] = [];
    let running = income;
    items.push({ name: "Income", value: income, start: 0, isIncome: true, isNet: false });
    const top = pieData.slice(0, 6);
    for (const { name, value } of top) {
      const start = running - value;
      items.push({ name, value, start, isIncome: false, isNet: false });
      running -= value;
    }
    if (ccTotal > 0) {
      const start = running - ccTotal;
      items.push({ name: "CC Spend", value: ccTotal, start, isIncome: false, isNet: false });
      running -= ccTotal;
    }
    items.push({ name: "Net", value: Math.abs(running), start: running >= 0 ? 0 : running, isIncome: false, isNet: true });
    return { items, net: running };
  }, [income, pieData, ccTotal]);

  const maxVal = income > 0 ? income : 1;
  const hasData = income > 0 || pieData.length > 0;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide">Cash Flow Waterfall</p>
        <span className={"text-xs font-bold tabular-nums " + (net >= 0 ? "text-emerald-400" : "text-red-400")}>
          Net {net >= 0 ? "+" : ""}{fmt(net)}
        </span>
      </div>
      {!hasData ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-foreground/30">No data yet</div>
      ) : (
        <div className="flex gap-1">
          {items.map(({ name, value, start, isIncome, isNet }, i) => {
            const heightPct = (value / maxVal) * 100;
            const startPct  = ((start < 0 ? 0 : start) / maxVal) * 100;
            const barColor = isIncome ? "#10b981"
              : isNet ? (net >= 0 ? "#10b981" : "#ef4444")
              : PIE_COLORS[i % PIE_COLORS.length];
            return (
              <div key={name} className="flex-1 flex flex-col items-center group">
                {/* Bar area */}
                <div className="relative w-full" style={{ height: 150 }}>
                  <div
                    className="absolute left-0 right-0 rounded-sm transition-all duration-300"
                    style={{
                      bottom: `${startPct}%`,
                      height: `${Math.max(heightPct, 1)}%`,
                      background: barColor,
                      opacity: isNet ? 1 : 0.82,
                    }}
                  />
                  {/* connector line to next bar (except last) */}
                  {!isNet && i < items.length - 1 && (
                    <div
                      className="absolute right-0 w-px bg-foreground/15"
                      style={{ bottom: `${startPct + heightPct}%`, height: "2px" }}
                    />
                  )}
                  {/* Hover tooltip */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-[10px] font-semibold text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 shadow-lg">
                    {name}: {fmt(value)}
                  </div>
                </div>
                {/* Label below bar */}
                <span className="text-[9px] text-foreground/40 text-center truncate w-full px-0.5 mt-1.5 leading-tight">
                  {name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── FixedVsVariableDonut ──────────────────────────────────────────────────────

export function FixedVsVariableDonut({
  income,
  fixedExp,
  floatExp,
  ccTotal,
  net,
}: {
  income: number;
  fixedExp: number;
  floatExp: number;
  ccTotal: number;
  net: number;
}) {
  const segments = useMemo(() => [
    { name: "Fixed",    value: Math.round(fixedExp),                   fill: "#8b5cf6" },
    { name: "Variable", value: Math.round(floatExp),                   fill: "#f59e0b" },
    { name: "CC Spend", value: Math.round(ccTotal),                    fill: "#f43f5e" },
    { name: "Savings",  value: Math.round(Math.max(0, net - ccTotal)), fill: "#10b981" },
  ].filter((s) => s.value > 0), [fixedExp, floatExp, ccTotal, net]);

  const hasData = segments.length > 0 && income > 0;
  const savingsRate = income > 0 ? Math.round((Math.max(0, net) / income) * 100) : 0;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">Spending Breakdown</p>
      {!hasData ? (
        <div className="h-[180px] flex items-center justify-center text-sm text-foreground/30">No data yet</div>
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative shrink-0" style={{ width: 150, height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segments} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={46} outerRadius={68}
                  paddingAngle={2} strokeWidth={0} startAngle={90} endAngle={-270}>
                  {segments.map((s, i) => <Cell key={i} fill={s.fill} />)}
                </Pie>
                <Tooltip
                  formatter={(v: unknown) => [fmt(Number(v)), ""]}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, color: "var(--foreground)" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className={"text-lg font-black tabular-nums leading-none " +
                (savingsRate >= 20 ? "text-emerald-400" : savingsRate >= 10 ? "text-amber-400" : "text-red-400")}>
                {savingsRate}%
              </span>
              <span className="text-[9px] text-foreground/40 uppercase tracking-wide mt-0.5">saved</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {segments.map((s) => {
              const pct = income > 0 ? Math.round((s.value / income) * 100) : 0;
              return (
                <div key={s.name} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.fill }} />
                      <span className="text-xs text-foreground/70">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground/80 tabular-nums">{fmt(s.value)}</span>
                      <span className="text-[10px] text-foreground/35 w-7 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-foreground/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: pct + "%", background: s.fill }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CategoryAnnualCards ──────────────────────────────────────────────────────

export function CategoryAnnualCards({ entries, year }: { entries: BudgetEntry[]; year: number }) {
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    label: SHORT_MONTHS[i],
    key: `${year}-${String(i + 1).padStart(2, "0")}`,
  })), [year]);

  const catData = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const e of entries) {
      if (e.type?.toUpperCase() !== "EXPENSE") continue;
      const cat = e.category || "Other";
      if (!map[cat]) map[cat] = Array(12).fill(0);
      const et = (e.entry_type ?? "FLOATING").toUpperCase();
      if (et !== "RECURRING") {
        const mi = months.findIndex((m) => m.key === e.date.slice(0, 7));
        if (mi >= 0) map[cat][mi] += e.amount;
      } else {
        months.forEach(({ key }, mi) => {
          if (recurringAppliesToMonth(e, key)) {
            const m2 = RECURRENCE_MONTHS[(e.recurrence ?? "ANNUAL") as BudgetRecurrence];
            map[cat][mi] += e.amount / m2;
          }
        });
      }
    }
    return map;
  }, [entries, months, year]);

  const categories = useMemo(
    () => Object.entries(catData)
      .map(([name, vals]) => ({ name, vals, total: vals.reduce((s, v) => s + v, 0) }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total),
    [catData],
  );

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wide px-1">
        Category Spend — Monthly Breakdown
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {categories.map(({ name, vals, total }, ci) => {
          const color = PIE_COLORS[ci % PIE_COLORS.length];
          const chartData = months.map(({ label }, i) => ({ month: label, Amount: Math.round(vals[i]) }));
          const maxVal = Math.max(...vals, 1);
          const activeMonths = vals.filter((v) => v > 0).length;
          const avgMonthly = activeMonths > 0 ? total / activeMonths : 0;

          return (
            <div key={name} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-sm font-bold text-foreground truncate">{name}</span>
                </div>
                <span className="text-sm font-black text-foreground/80 tabular-nums shrink-0">{fmt(total)}</span>
              </div>
              <div className="flex gap-3 text-[11px] text-foreground/45">
                <span>Avg <span className="text-foreground/70 font-semibold">{fmt(avgMonthly)}</span>/mo</span>
                <span>{activeMonths} of 12 months</span>
              </div>
              <div className="mt-1">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={chartData} barCategoryGap="20%" margin={{ top: 0, right: 0, left: -32, bottom: 0 }}>
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 8, fill: "var(--foreground)", opacity: 0.4 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis hide domain={[0, maxVal * 1.15]} />
                    <Tooltip
                      formatter={(v: unknown) => [fmt(Number(v)), name]}
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 11,
                        color: "var(--foreground)",
                      }}
                      itemStyle={{ color: "var(--foreground)" }}
                      cursor={{ fill: "var(--surface-2)" }}
                    />
                    <Bar dataKey="Amount" radius={[3, 3, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={vals[i] > 0 ? color : "var(--surface-2)"} fillOpacity={vals[i] > 0 ? 0.85 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
