// ── THIS FILE IS AUTO-SPLIT — edit components in /web/components/budget/ ──────
"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchBudget, fetchCCWeeks, fetchBudgetOverrides,
  BudgetEntry, CreditCardWeek, BudgetOverride,
} from "@/lib/api";
import { ChevronLeft, ChevronRight, TrendingUp, Zap, Repeat } from "lucide-react";
import { Section } from "@/components/budget/BudgetSection";
import {
  SavingsRate, TopCategoriesBar, IncomeExpenseSplit, ExpensePieChart, TrendChart,
  CashFlowWaterfall, FixedVsVariableDonut,
} from "@/components/budget/BudgetCharts";
import { AnnualSummary } from "@/components/budget/BudgetAnnualSummary";
import { CCSection, StatCard } from "@/components/budget/CCSection";
import {
  fmt, monthKey, monthLabel, proratedMonthly, recurringAppliesToMonth,
} from "@/components/budget/BudgetHelpers";

export default function BudgetPage() {
  const { data: allEntries = [], isLoading } = useQuery<BudgetEntry[]>({
    queryKey: ["budget"],
    queryFn: fetchBudget,
    staleTime: 30_000,
  });

  const { data: allOverrides = [] } = useQuery<BudgetOverride[]>({
    queryKey: ["budget-overrides"],
    queryFn: fetchBudgetOverrides,
    staleTime: 30_000,
  });

  const [currentMonth, setCurrentMonth] = useState(() => monthKey(new Date()));

  const prev = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    setCurrentMonth(monthKey(new Date(y, m - 2, 1)));
  };
  const next = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    setCurrentMonth(monthKey(new Date(y, m, 1)));
  };

  const overrideMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of allOverrides) {
      if (o.month_key === currentMonth) map[String(o.budget_id)] = o.amount;
    }
    return map;
  }, [allOverrides, currentMonth]);

  const { floating, recurring, incomeRows } = useMemo(() => {
    const floating: { entry: BudgetEntry; displayAmount: number }[] = [];
    const recurring: { entry: BudgetEntry; displayAmount: number }[] = [];
    const incomeRows: { entry: BudgetEntry; displayAmount: number }[] = [];
    for (const entry of allEntries) {
      const et = (entry.entry_type ?? "FLOATING").toUpperCase();
      const typeUp = entry.type?.toUpperCase();
      if (et !== "RECURRING") {
        if (entry.date.slice(0, 7) === currentMonth) {
          if (typeUp === "INCOME") incomeRows.push({ entry, displayAmount: entry.amount });
          else floating.push({ entry, displayAmount: entry.amount });
        }
      } else {
        if (recurringAppliesToMonth(entry, currentMonth)) {
          const base = proratedMonthly(entry);
          const effective = overrideMap[String(entry.id)] ?? base;
          if (typeUp === "INCOME") incomeRows.push({ entry, displayAmount: effective });
          else recurring.push({ entry, displayAmount: effective });
        }
      }
    }
    return { floating, recurring, incomeRows };
  }, [allEntries, currentMonth, overrideMap]);

  const stats = useMemo(() => {
    const expense  = [...floating, ...recurring].reduce((s, r) => s + r.displayAmount, 0);
    const income   = incomeRows.reduce((s, r) => s + r.displayAmount, 0);
    const fixedExp = recurring.reduce((s, r) => s + r.displayAmount, 0);
    return { expense, income, fixedExp, net: income - expense };
  }, [floating, recurring, incomeRows]);

  const { data: allCCWeeks = [] } = useQuery<CreditCardWeek[]>({
    queryKey: ["cc-weeks"],
    queryFn: fetchCCWeeks,
    staleTime: 30_000,
  });

  const ccMonthTotal = useMemo(() => {
    return allCCWeeks
      .filter(
        (r) =>
          r.week_start.slice(0, 7) === currentMonth &&
          (!r.card_name || !r.card_name.toLowerCase().startsWith("robinhood")),
      )
      .reduce((s, r) => s + (r.balance ?? 0), 0);
  }, [allCCWeeks, currentMonth]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const { entry, displayAmount } of [...floating, ...recurring]) {
      map[entry.category] = (map[entry.category] ?? 0) + displayAmount;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [floating, recurring]);

  const totalEntries = floating.length + recurring.length + incomeRows.length;
  const [activeTab, setActiveTab] = useState<"monthly" | "annual">("monthly");
  const currentYear = Number(currentMonth.split("-")[0]);

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto w-full">

      {/* Header + tabs */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <h1 className="text-xl sm:text-2xl font-black text-foreground shrink-0">Budget</h1>
        <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1">
          <button
            onClick={() => setActiveTab("monthly")}
            className={
              "px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition " +
              (activeTab === "monthly"
                ? "bg-blue-600 text-white shadow"
                : "text-foreground/50 hover:text-foreground")
            }
          >
            Monthly
          </button>
          <button
            onClick={() => setActiveTab("annual")}
            className={
              "px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition " +
              (activeTab === "annual"
                ? "bg-blue-600 text-white shadow"
                : "text-foreground/50 hover:text-foreground")
            }
          >
            <span className="hidden sm:inline">Annual Summary</span>
            <span className="sm:hidden">Annual</span>
          </button>
        </div>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-2.5 mb-5">
        <button
          onClick={prev}
          className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] transition text-foreground/60 hover:text-foreground"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          {activeTab === "monthly" ? (
            <>
              <p className="font-bold text-foreground">{monthLabel(currentMonth)}</p>
              <p className="text-xs text-foreground/40 mt-0.5">
                {isLoading
                  ? "Loading..."
                  : `${totalEntries} entr${totalEntries === 1 ? "y" : "ies"}`}
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-foreground">{currentYear}</p>
              <p className="text-xs text-foreground/40 mt-0.5">Annual view</p>
            </>
          )}
        </div>
        <button
          onClick={next}
          className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] transition text-foreground/60 hover:text-foreground"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── MONTHLY TAB ──────────────────────────────────────────────────── */}
      {activeTab === "monthly" && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            <StatCard label="Income"      value={fmt(stats.income)}                 cls="text-emerald-400" />
            <StatCard label="Expenses"    value={fmt(stats.expense + ccMonthTotal)} cls="text-red-400" />
            <StatCard label="Fixed/Month" value={fmt(stats.fixedExp)}               cls="text-purple-400" />
            <StatCard
              label="Net"
              value={fmt(stats.income - stats.expense - ccMonthTotal)}
              cls={(stats.income - stats.expense - ccMonthTotal) >= 0 ? "text-emerald-400" : "text-red-400"}
            />
            <SavingsRate income={stats.income} net={stats.income - stats.expense - ccMonthTotal} />
          </div>

          {/* Charts */}
          {(pieData.length > 0 || stats.income > 0) && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <ExpensePieChart pieData={pieData} />
                <TopCategoriesBar pieData={pieData} />
                <IncomeExpenseSplit
                  income={stats.income}
                  expense={stats.expense + ccMonthTotal}
                  fixedExp={stats.fixedExp}
                  floatExp={stats.expense - stats.fixedExp + ccMonthTotal}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <CashFlowWaterfall
                  income={stats.income}
                  pieData={pieData}
                  ccTotal={ccMonthTotal}
                />
                <FixedVsVariableDonut
                  income={stats.income}
                  fixedExp={stats.fixedExp}
                  floatExp={stats.expense - stats.fixedExp}
                  ccTotal={ccMonthTotal}
                  net={stats.income - stats.expense - ccMonthTotal}
                />
              </div>
            </>
          )}

          {/* Budget sections — 2-column layout at lg: left = Income + One-off, right = Recurring + CC */}
          <div className="flex flex-col lg:flex-row gap-5 items-start mb-5">

            {/* Left column */}
            <div className="w-full lg:w-1/2 flex flex-col gap-5">
              <Section
                title="Income"
                icon={<TrendingUp size={14} />}
                accentCls="text-emerald-400"
                rows={incomeRows}
                isRecurring={false}
                currentMonth={currentMonth}
                overrides={allOverrides}
                typeFilter="INCOME"
              />
              <Section
                title="One-off / Floating"
                icon={<Zap size={14} />}
                accentCls="text-amber-400"
                rows={floating}
                isRecurring={false}
                currentMonth={currentMonth}
                overrides={allOverrides}
              />
            </div>

            {/* Right column */}
            <div className="w-full lg:w-1/2 flex flex-col gap-5">
              <Section
                title="Recurring / Fixed"
                icon={<Repeat size={14} />}
                accentCls="text-purple-400"
                rows={recurring}
                isRecurring={true}
                currentMonth={currentMonth}
                overrides={allOverrides}
              />
              <CCSection
                currentMonth={currentMonth}
                title="Credit Cards"
                accentColor="text-blue-400"
                cardFilter={(r) => !!r.card_name && !r.card_name.toLowerCase().startsWith("robinhood")}
                datalistId="cc-other-names"
              />
            </div>

          </div>

          {/* Robinhood Gold — full width below */}
          <CCSection
            currentMonth={currentMonth}
            title="Robinhood Gold"
            accentColor="text-rose-400"
            cardFilter={(r) => !r.card_name || r.card_name.toLowerCase().startsWith("robinhood")}
            defaultCard="Robinhood Gold"
            datalistId="cc-rh-names"
            fixedWeeks
          />
        </>
      )}

      {/* ── ANNUAL TAB ───────────────────────────────────────────────────── */}
      {activeTab === "annual" && (
        <div className="flex flex-col gap-5">
          <TrendChart entries={allEntries} />
          <AnnualSummary entries={allEntries} year={currentYear} />
        </div>
      )}
    </div>
  );
}
