"use client";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPortfolioSummary, fetchPremiumDashboard, fetchHoldings,
  WeekBreakdown,
} from "@/lib/api";
import { EmptyState, SkeletonCard } from "@/components/ui";
import { TrendingUp, TrendingDown, BarChart2, Calendar } from "lucide-react";
import { fmt$ } from "./TradesHelpers";

type MonthEntry = [string, number] | null;
type CumEntry = { label: string; cumulative: number; weekly: number };

export function YearTab() {
  const { data: s, isLoading: summaryLoading } = useQuery({
    queryKey: ["portfolioSummary"],
    queryFn: fetchPortfolioSummary,
    staleTime: 60_000,
  });
  const { data: premDash, isLoading: premLoading } = useQuery({
    queryKey: ["premiumDashboard"],
    queryFn: fetchPremiumDashboard,
    staleTime: 60_000,
  });
  const { data: holdings = [] } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
    staleTime: 60_000,
  });

  const isLoading = summaryLoading || premLoading;
  if (isLoading) return <div className="space-y-3">{[1, 2, 3, 4].map((i) => <SkeletonCard key={i} rows={2} />)}</div>;
  if (!s) return <EmptyState icon={BarChart2} title="No data yet" body="Complete a week to see your performance summary." />;

  const weeksBreakdown    = (s.weeks_breakdown ?? []) as WeekBreakdown[];
  const monthlyPremium    = (s.monthly_premium ?? {}) as Record<string, number>;
  const winRate           = s.win_rate ?? 0;
  const completeWeeks     = s.complete_weeks ?? 0;

  const completedPremiums = [...weeksBreakdown].filter((w) => w.is_complete && w.premium > 0).map((w) => w.premium);
  const weeklyMean        = completedPremiums.length > 0 ? completedPremiums.reduce((a, b) => a + b, 0) / completedPremiums.length : 0;
  const weeklyStdDev      = completedPremiums.length > 1
    ? Math.sqrt(completedPremiums.reduce((a, b) => a + Math.pow(b - weeklyMean, 2), 0) / completedPremiums.length)
    : 0;
  const consistencyScore  = weeklyMean > 0 ? Math.max(0, Math.min(100, 100 - (weeklyStdDev / weeklyMean) * 100)) : 0;

  const completedWeeks    = weeksBreakdown.filter((w) => w.is_complete);
  const streakBreak       = completedWeeks.findIndex((w) => w.premium <= 0);
  const currentStreak     = streakBreak === -1 ? completedWeeks.length : streakBreak;

  const avgPositionsPerWeek = completeWeeks > 0
    ? weeksBreakdown.filter((w) => w.is_complete).reduce((a, w) => a + w.position_count, 0) / completeWeeks
    : 0;

  const monthlyEntries2 = Object.entries(monthlyPremium).sort((a, b) => a[0].localeCompare(b[0]));
  const bestMonth  = monthlyEntries2.reduce((best, cur) => !best || cur[1] > best[1] ? cur : best, null as MonthEntry);
  const worstMonth = monthlyEntries2.filter((e) => e[1] > 0).reduce((worst, cur) => !worst || cur[1] < worst[1] ? cur : worst, null as MonthEntry);

  const realizedPrem      = premDash?.grand_total.realized_premium   ?? 0;
  const inFlightPrem      = premDash?.grand_total.unrealized_premium  ?? 0;
  const totalPremForSplit = realizedPrem + inFlightPrem;
  const realizedPct       = totalPremForSplit > 0 ? (realizedPrem / totalPremForSplit) * 100 : 0;

  const monthNames: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
    "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
  };

  const chronoWeeks   = [...weeksBreakdown].reverse();
  const cumulativeData = chronoWeeks.reduce((acc, w) => {
    const prev  = acc[acc.length - 1]?.cumulative ?? 0;
    const label = new Date(w.week_end + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    acc.push({ label, cumulative: prev + w.premium, weekly: w.premium });
    return acc;
  }, [] as CumEntry[]);

  const activePremWeeks  = chronoWeeks.filter((w) => w.premium > 0);
  const avgWeeklyPremium = activePremWeeks.length > 0
    ? activePremWeeks.reduce((acc, w) => acc + w.premium, 0) / activePremWeeks.length
    : 0;
  const annualProjection  = avgWeeklyPremium * 52;
  const monthlyProjection = avgWeeklyPremium * 4.33;

  const holdingProjections = holdings
    .filter((h) => h.status === "ACTIVE" && h.shares > 0)
    .map((h) => {
      const weeklyRate    = avgWeeklyPremium > 0
        ? (premDash?.by_symbol.find((r) => r.symbol === h.symbol)?.total_premium_sold ?? 0) / Math.max(1, activePremWeeks.length)
        : 0;
      const weeksToZero   = weeklyRate > 0 ? Math.ceil(Math.max(0, (h.live_adj_basis ?? h.cost_basis) * h.shares) / weeklyRate) : null;
      const pctReduced    = h.cost_basis > 0 ? ((h.cost_basis - (h.live_adj_basis ?? h.cost_basis)) / h.cost_basis) * 100 : 0;
      return {
        symbol: h.symbol, cost_basis: h.cost_basis, live_adj: h.live_adj_basis ?? h.cost_basis,
        pctReduced, weeksToZero, shares: h.shares,
        premiumSold: premDash?.by_symbol.find((r) => r.symbol === h.symbol)?.total_premium_sold ?? 0,
      };
    })
    .sort((a, b) => b.premiumSold - a.premiumSold);

  const monthlyEntries    = Object.entries(monthlyPremium).sort((a, b) => a[0].localeCompare(b[0]));
  const maxMonthlyPremium = Math.max(...monthlyEntries.map((e) => e[1]), 1);
  const maxWeekly         = Math.max(...cumulativeData.map((d) => d.weekly), 1);

  const totalCostBasis     = holdings.reduce((acc, h) => acc + h.cost_basis * h.shares, 0);
  const premiumEfficiency  = totalCostBasis > 0 ? ((premDash?.grand_total.total_premium_sold ?? 0) / totalCostBasis) * 100 : 0;
  const totalPremCollected = premDash?.grand_total.total_premium_sold ?? s.total_premium_collected;
  const weeksToFullCover   = avgWeeklyPremium > 0 ? Math.ceil(totalCostBasis / avgWeeklyPremium) : null;

  return (
    <div className="space-y-6">

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-1">Total Collected</p>
          <p className="text-xl font-black text-green-500">${totalPremCollected.toFixed(2)}</p>
          <p className="text-[10px] text-foreground/50 mt-0.5">{completeWeeks} weeks logged</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-1">Avg / Week</p>
          <p className="text-xl font-black text-blue-500">${avgWeeklyPremium.toFixed(2)}</p>
          <p className="text-[10px] text-foreground/50 mt-0.5">from {activePremWeeks.length} active weeks</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-1">Annual Run Rate</p>
          <p className="text-xl font-black text-purple-500">${annualProjection.toFixed(0)}</p>
          <p className="text-[10px] text-foreground/50 mt-0.5">${monthlyProjection.toFixed(0)}/mo projected</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-1">Yield on Cost</p>
          <p className="text-xl font-black text-orange-400">{premiumEfficiency.toFixed(2)}%</p>
          <p className="text-[10px] text-foreground/50 mt-0.5">premium ÷ total cost basis</p>
        </div>
      </div>

      {/* ── Row 2: Win rate + coverage + tax ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between">
          <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-2">Win Rate</p>
          <div>
            <p className="text-3xl font-black text-blue-500">{winRate.toFixed(0)}%</p>
            <p className="text-xs text-foreground/50 mt-1">{completeWeeks}/{s.total_weeks} weeks profitable</p>
          </div>
          <div className="mt-3 h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${winRate}%` }} />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between">
          <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-2">Cost Basis Coverage</p>
          <div>
            <p className="text-3xl font-black text-foreground">
              {totalCostBasis > 0 ? ((totalPremCollected / totalCostBasis) * 100).toFixed(2) : "0.00"}%
            </p>
            <p className="text-xs text-foreground/50 mt-1">
              ${totalPremCollected.toFixed(0)} of ${totalCostBasis.toFixed(0)} total cost
            </p>
          </div>
          <div className="mt-3 h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, totalCostBasis > 0 ? (totalPremCollected / totalCostBasis) * 100 : 0)}%` }}
            />
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between">
          <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-2">Est. Tax ({(s.cap_gains_tax_rate * 100).toFixed(0)}%)</p>
          <div>
            <p className="text-3xl font-black text-orange-400">${s.estimated_tax.toFixed(2)}</p>
            <p className="text-xs text-foreground/50 mt-1">on ${s.realized_pnl.toFixed(2)} realized P/L</p>
          </div>
          {weeksToFullCover && (
            <p className="mt-3 text-[10px] text-foreground/40">
              ~{weeksToFullCover} weeks to fully cover cost basis at current rate
            </p>
          )}
        </div>
      </div>

      {/* ── Cumulative premium curve ── */}
      {cumulativeData.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-green-500" />
              <h3 className="text-sm font-bold text-foreground">Premium Accumulation</h3>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-foreground/50">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-1 bg-green-500 rounded" />Weekly</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-1 bg-blue-400 rounded" />Cumulative</span>
            </div>
          </div>
          <div className="relative h-40">
            <div className="absolute inset-0 flex items-end gap-1 px-1">
              {cumulativeData.map((d, i) => {
                const barPct = Math.max(2, Math.round((d.weekly / maxWeekly) * 75));
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full rounded-t bg-green-500/30 border border-green-500/50" style={{ height: `${barPct}%` }} />
                  </div>
                );
              })}
            </div>
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              {(() => {
                const maxCum = Math.max(...cumulativeData.map((d) => d.cumulative), 1);
                const n = cumulativeData.length;
                if (n < 2) return null;
                const pts = cumulativeData.map((d, i) => {
                  const x = (i / (n - 1)) * 100;
                  const y = 100 - (d.cumulative / maxCum) * 85;
                  return `${x},${y}`;
                });
                const areaPath = `M${pts[0]} L${pts.join(" L")} L100,100 L0,100 Z`;
                return (
                  <>
                    <defs>
                      <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#cumGrad)" />
                    <polyline points={pts.join(" ")} fill="none" stroke="#60a5fa" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    {cumulativeData.map((d, i) => {
                      const x = (i / (n - 1)) * 100;
                      const y = 100 - (d.cumulative / maxCum) * 85;
                      return <circle key={i} cx={`${x}%`} cy={`${y}%`} r="3" fill="#60a5fa" />;
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
          <div className="flex mt-2 px-1">
            {cumulativeData.map((d, i) => (
              <div key={i} className="flex-1 text-center">
                <span className="text-[9px] text-foreground/50">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between">
            <span className="text-xs text-foreground/50">Running total</span>
            <span className="text-sm font-black text-blue-400">
              ${(cumulativeData[cumulativeData.length - 1]?.cumulative ?? 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* ── Annual projection ── */}
      {avgWeeklyPremium > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-purple-500" />
            <h3 className="text-sm font-bold text-foreground">Annual Projection</h3>
            <span className="ml-auto text-[10px] text-foreground/40">based on ${avgWeeklyPremium.toFixed(2)}/wk avg</span>
          </div>
          <div className="space-y-2">
            {[3, 6, 9, 12].map((months) => {
              const proj = avgWeeklyPremium * months * 4.33;
              const pct  = Math.min(100, (proj / (annualProjection * 1.1)) * 100);
              const label = months === 12 ? "12 mo (full year)" : `${months} mo`;
              return (
                <div key={months} className="flex items-center gap-3">
                  <span className="text-[11px] text-foreground/60 w-24 shrink-0">{label}</span>
                  <div className="flex-1 h-5 bg-[var(--surface-2)] rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-purple-500/70 rounded-lg flex items-center px-2 transition-all"
                      style={{ width: `${pct}%` }}
                    >
                      {pct > 20 && <span className="text-[10px] font-bold text-white">${proj.toFixed(0)}</span>}
                    </div>
                  </div>
                  {pct <= 20 && <span className="text-[11px] font-bold text-purple-400">${proj.toFixed(0)}</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[["Monthly", monthlyProjection], ["Quarterly", monthlyProjection * 3], ["Annual", annualProjection]].map(([label, val]) => (
              <div key={label as string} className="bg-[var(--surface-2)] rounded-lg p-2">
                <p className="text-[9px] text-foreground/50 uppercase tracking-wide">{label}</p>
                <p className="text-sm font-black text-purple-400">${(val as number).toFixed(0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Basis reduction by holding ── */}
      {holdingProjections.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={14} className="text-green-500" />
            <h3 className="text-sm font-bold text-foreground">Cost Basis Reduction by Holding</h3>
            <span className="ml-auto text-[10px] text-foreground/40">live adj vs original cost</span>
          </div>
          <div className="space-y-3">
            {holdingProjections.map((h) => {
              const reduction    = h.cost_basis - h.live_adj;
              const reductionPct = h.cost_basis > 0 ? (reduction / h.cost_basis) * 100 : 0;
              return (
                <div key={h.symbol}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{h.symbol}</span>
                      <span className="text-[10px] text-foreground/50">{h.shares} shares</span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-[11px] text-foreground/50">
                        ${h.cost_basis.toFixed(2)} → <span className="text-green-500 font-semibold">${h.live_adj.toFixed(2)}</span>
                      </span>
                      <span className="text-[11px] font-bold text-green-500 w-12 text-right">-{reductionPct.toFixed(2)}%</span>
                    </div>
                  </div>
                  <div className="h-4 bg-[var(--surface-2)] rounded-lg overflow-hidden relative">
                    <div className="h-full bg-green-500/25 rounded-lg" style={{ width: "100%" }} />
                    <div className="absolute inset-y-0 left-0 bg-green-500 rounded-lg" style={{ width: `${Math.min(100, reductionPct)}%` }} />
                    {h.weeksToZero && (
                      <span className="absolute right-2 inset-y-0 flex items-center text-[9px] text-foreground/40">
                        ~{h.weeksToZero}w to break even
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[9px] text-foreground/40">${h.premiumSold.toFixed(2)} collected</span>
                    <span className="text-[9px] text-foreground/40">${(h.cost_basis * h.shares).toFixed(2)} total position</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Consistency + Streak + Avg Positions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between">
          <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-2">Consistency</p>
          <div>
            <p className="text-3xl font-black" style={{ color: consistencyScore >= 70 ? "#22c55e" : consistencyScore >= 40 ? "#f59e0b" : "#ef4444" }}>
              {consistencyScore.toFixed(0)}<span className="text-lg font-semibold text-foreground/40">/100</span>
            </p>
            <p className="text-xs text-foreground/50 mt-1">σ ${weeklyStdDev.toFixed(2)} · avg ${weeklyMean.toFixed(2)}/wk</p>
          </div>
          <div className="mt-3 h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${consistencyScore}%`, background: consistencyScore >= 70 ? "#22c55e" : consistencyScore >= 40 ? "#f59e0b" : "#ef4444" }} />
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between">
          <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-2">Current Streak</p>
          <div>
            <p className="text-3xl font-black text-yellow-400">{currentStreak}<span className="text-lg font-semibold text-foreground/40"> wks</span></p>
            <p className="text-xs text-foreground/50 mt-1">consecutive profitable weeks</p>
          </div>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: Math.min(8, completeWeeks) }).map((_, i) => {
              const w = [...weeksBreakdown].filter((w) => w.is_complete)[i];
              return <div key={i} className="flex-1 h-2 rounded-full" style={{ background: w ? (w.premium > 0 ? "#facc15" : "#ef4444") : "var(--surface-2)" }} />;
            })}
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between">
          <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-2">Avg Positions / Week</p>
          <div>
            <p className="text-3xl font-black text-blue-400">{avgPositionsPerWeek.toFixed(1)}</p>
            <p className="text-xs text-foreground/50 mt-1">across {completeWeeks} complete weeks</p>
          </div>
          <p className="mt-3 text-[10px] text-foreground/40">
            ${avgPositionsPerWeek > 0 ? (weeklyMean / avgPositionsPerWeek).toFixed(2) : "0.00"} avg per position deployed
          </p>
        </div>
      </div>

      {/* ── Realized vs In-flight + Best/Worst month ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {totalPremForSplit > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-3">Realized vs In-Flight</p>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-xl font-black text-blue-500">${realizedPrem.toFixed(0)}</span>
              <span className="text-sm text-foreground/40 mb-0.5">locked in</span>
              <span className="ml-auto text-xl font-black text-orange-400">${inFlightPrem.toFixed(0)}</span>
              <span className="text-sm text-foreground/40 mb-0.5">active</span>
            </div>
            <div className="h-3 bg-[var(--surface-2)] rounded-full overflow-hidden flex">
              <div className="h-full bg-blue-500 rounded-l-full transition-all" style={{ width: `${realizedPct}%` }} />
              <div className="h-full bg-orange-400 flex-1 rounded-r-full" />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-foreground/40">
              <span>{realizedPct.toFixed(0)}% realized</span>
              <span>{(100 - realizedPct).toFixed(0)}% in-flight</span>
            </div>
          </div>
        )}
        {(bestMonth || worstMonth) && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-3">Best / Worst Month</p>
            <div className="flex gap-4">
              {bestMonth && (
                <div className="flex-1">
                  <p className="text-[10px] text-green-500 font-semibold uppercase mb-1">Best</p>
                  <p className="text-lg font-black text-green-500">${bestMonth[1].toFixed(0)}</p>
                  <p className="text-xs text-foreground/50">{monthNames[bestMonth[0].split("-")[1]] ?? bestMonth[0]}</p>
                </div>
              )}
              {worstMonth && (
                <div className="flex-1">
                  <p className="text-[10px] text-orange-400 font-semibold uppercase mb-1">Lightest</p>
                  <p className="text-lg font-black text-orange-400">${worstMonth[1].toFixed(0)}</p>
                  <p className="text-xs text-foreground/50">{monthNames[worstMonth[0].split("-")[1]] ?? worstMonth[0]}</p>
                </div>
              )}
              {bestMonth && worstMonth && bestMonth[0] !== worstMonth[0] && (
                <div className="flex-1">
                  <p className="text-[10px] text-foreground/40 font-semibold uppercase mb-1">Range</p>
                  <p className="text-lg font-black text-foreground/60">${(bestMonth[1] - worstMonth[1]).toFixed(0)}</p>
                  <p className="text-xs text-foreground/50">spread</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Best / Worst week ── */}
      {(s.best_week || s.worst_week) && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-wide mb-3">Best / Weakest Week</p>
          <div className="flex gap-4">
            {s.best_week && s.best_week.premium > 0 && (
              <div className="flex-1">
                <p className="text-[10px] text-green-500 font-semibold uppercase mb-1">Best</p>
                <p className="text-lg font-black text-green-500">${s.best_week.premium.toFixed(0)}</p>
                <p className="text-xs text-foreground/50">{s.best_week.week_end}</p>
                <p className="text-[10px] text-foreground/40">{s.best_week.position_count} positions</p>
              </div>
            )}
            {s.worst_week && s.worst_week.id !== s.best_week?.id && (
              <div className="flex-1">
                <p className="text-[10px] text-orange-400 font-semibold uppercase mb-1">Weakest</p>
                <p className={`text-lg font-black ${s.worst_week.premium >= 0 ? "text-orange-400" : "text-red-500"}`}>{fmt$(s.worst_week.premium)}</p>
                <p className="text-xs text-foreground/50">{s.worst_week.week_end}</p>
                <p className="text-[10px] text-foreground/40">{s.worst_week.position_count} positions</p>
              </div>
            )}
            {s.best_week && s.worst_week && s.best_week.premium > 0 && s.worst_week.id !== s.best_week?.id && (
              <div className="flex-1">
                <p className="text-[10px] text-foreground/40 font-semibold uppercase mb-1">Range</p>
                <p className="text-lg font-black text-foreground/60">${(s.best_week.premium - s.worst_week.premium).toFixed(0)}</p>
                <p className="text-xs text-foreground/50">spread</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Monthly chart + Week-by-week ── */}
      {(monthlyEntries.length > 0 || weeksBreakdown.length > 0) && (
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {monthlyEntries.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 w-full sm:shrink-0 sm:w-auto" style={{ minWidth: 0 }}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={14} className="text-green-500" />
                <h3 className="text-sm font-bold text-foreground">Monthly Premium</h3>
              </div>
              <div className="flex items-end gap-1.5 h-56 overflow-x-auto">
                {monthlyEntries.map((entry) => {
                  const ym = entry[0]; const val = entry[1];
                  const [, month] = ym.split("-");
                  const pct = Math.max(3, Math.round((val / maxMonthlyPremium) * 100));
                  const hasData = val > 0;
                  return (
                    <div key={ym} className="flex flex-col items-center gap-1 h-full justify-end" style={{ minWidth: "28px", flex: "1 1 0" }}>
                      <span className="text-[9px] text-foreground/70 font-semibold leading-none mb-0.5 whitespace-nowrap">
                        {hasData ? (val >= 1000 ? "$" + (val / 1000).toFixed(1) + "k" : "$" + val.toFixed(0)) : ""}
                      </span>
                      <div className={`w-full rounded-t ${hasData ? "bg-green-500" : "bg-[var(--surface-2)]"}`} style={{ height: `${pct}%` }} />
                      <span className="text-[9px] text-foreground/50 leading-none mt-0.5 whitespace-nowrap">{monthNames[month] ?? month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {weeksBreakdown.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden w-full sm:flex-1 sm:min-w-0">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <h3 className="text-sm font-bold text-foreground">Week-by-Week</h3>
              </div>
              <div className="sm:hidden divide-y divide-[var(--border)]">
                {weeksBreakdown.map((w) => {
                  const vsAvg = avgWeeklyPremium > 0 ? ((w.premium - avgWeeklyPremium) / avgWeeklyPremium) * 100 : null;
                  return (
                    <div key={w.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-foreground">{w.week_end}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${w.is_complete ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300" : "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300"}`}>
                          {w.is_complete ? "Complete" : "Active"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <span className={`font-semibold ${w.premium >= 0 ? "text-green-500" : "text-red-500"}`}>{fmt$(w.premium)}</span>
                        {vsAvg !== null && w.is_complete && (
                          <span className={`text-xs font-semibold ${vsAvg >= 0 ? "text-green-500" : "text-red-400"}`}>
                            {vsAvg >= 0 ? "▲" : "▼"} {Math.abs(vsAvg).toFixed(0)}% vs avg
                          </span>
                        )}
                        <span className={`text-xs font-semibold ${w.realized_pnl >= 0 ? "text-green-500" : "text-red-500"}`}>{fmt$(w.realized_pnl)}</span>
                        <span className="text-xs text-foreground/50">{w.position_count} pos</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[10px] text-foreground/60 uppercase tracking-wide bg-[var(--surface-2)]">
                      {["Week Ending", "Status", "Positions", "Premium", "vs Avg", "Realized P/L", "Account Value"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeksBreakdown.map((w) => {
                      const vsAvg = avgWeeklyPremium > 0 ? ((w.premium - avgWeeklyPremium) / avgWeeklyPremium) * 100 : null;
                      return (
                        <tr key={w.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-foreground">{w.week_end}</td>
                          <td className="px-4 py-2.5">
                            {w.is_complete
                              ? <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300 px-2 py-0.5 rounded-full font-semibold">Complete</span>
                              : <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">Active</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-foreground/70">{w.position_count}</td>
                          <td className={`px-4 py-2.5 font-semibold ${w.premium >= 0 ? "text-green-500" : "text-red-500"}`}>{fmt$(w.premium)}</td>
                          <td className="px-4 py-2.5">
                            {vsAvg !== null && w.is_complete
                              ? <span className={`text-xs font-semibold ${vsAvg >= 0 ? "text-green-500" : "text-red-400"}`}>{vsAvg >= 0 ? "▲" : "▼"} {Math.abs(vsAvg).toFixed(0)}%</span>
                              : <span className="text-foreground/30">—</span>}
                          </td>
                          <td className={`px-4 py-2.5 font-semibold ${w.realized_pnl >= 0 ? "text-green-500" : "text-red-500"}`}>{fmt$(w.realized_pnl)}</td>
                          <td className="px-4 py-2.5 text-foreground/70">{w.account_value != null ? `$${w.account_value.toLocaleString()}` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {weeksBreakdown.length === 0 && (
        <EmptyState icon={Calendar} title="No completed weeks yet" body="Mark a week complete to populate your performance summary." />
      )}
    </div>
  );
}
