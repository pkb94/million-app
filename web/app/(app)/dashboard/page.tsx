"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { fetchPortfolioSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import TickerSearchInput from "@/components/TickerSearchInput";
import { ArrowRight } from "lucide-react";
import { PageHeader, SectionLabel, RefreshButton } from "@/components/ui";
import MarketCards from "@/components/dashboard/MarketCards";
import VixPanel from "@/components/dashboard/VixPanel";
import EconomicCalendar from "@/components/dashboard/EconomicCalendar";

const QUICK = [
  { href: "/options-flow", label: "GEX Flow",    sub: "Gamma exposure data",  color: "from-purple-500 to-purple-700" },
  { href: "/trades",       label: "Trades",      sub: "View all positions",   color: "from-blue-500 to-blue-700" },
  { href: "/accounts",     label: "Accounts",    sub: "Manage portfolios",    color: "from-emerald-500 to-emerald-700" },
  { href: "/budget",       label: "Budget",      sub: "Track expenses",       color: "from-orange-500 to-orange-600" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [lookupQuery, setLookupQuery] = useState("");

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const t = lookupQuery.trim().toUpperCase();
    if (t) router.push(`/stocks/${t}`);
  };

  const summaryQ  = useQuery({ queryKey: ["portfolioSummary"],  queryFn: fetchPortfolioSummary,   staleTime: 60_000 });

  const handleRefresh = () => {
    summaryQ.refetch();
  };
  const isRefreshing = summaryQ.isFetching;

  return (
    <div className="p-4 sm:p-6 w-full overflow-x-hidden">

      <PageHeader
        title={user?.username ? `Hey, ${user.username} 👋` : "Dashboard"}
        sub="Your portfolio at a glance."
        action={
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={handleRefresh} isRefreshing={isRefreshing} />
          </div>
        }
      />

      {/* ── Slim stock search bar ── */}
      <div className="mb-6">
        <TickerSearchInput
          value={lookupQuery}
          onChange={setLookupQuery}
          onSelect={(sym) => {
            setLookupQuery(sym);
            router.push(`/stocks/${encodeURIComponent(sym.trim().toUpperCase())}`);
          }}
          placeholder="Search ticker or company — AAPL, Apple, Nifty…"
          actionLabel="View"
          className="w-full max-w-xl"
        />
      </div>

      {/* ── Portfolio Balance Chart ── */}
      {(() => {
        const weeks = summaryQ.data?.weeks_breakdown ?? [];
        const pts = [...weeks].reverse().filter(w => w.account_value != null) as { id: number; week_end: string; account_value: number; premium: number }[];
        if (pts.length === 0) return null;
        const latest = pts[pts.length - 1];
        const first  = pts[0];
        const change  = pts.length >= 2 ? latest.account_value - first.account_value : null;
        const changePct = change != null && first.account_value > 0 ? (change / first.account_value) * 100 : null;
        const up = change == null ? true : change >= 0;
        const chartData = pts.map(w => ({
          date: new Date(w.week_end + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          value: w.account_value,
          premium: w.premium,
        }));
        return (
          <div className="mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wide mb-1">Portfolio Balance</p>
                <p className={`text-2xl sm:text-3xl font-black ${up ? "text-green-500" : "text-red-500"}`}>
                  ${latest.account_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={`text-xs mt-1 font-semibold ${up ? "text-green-500" : "text-red-500"}`}>
                  {change != null
                    ? `${change >= 0 ? "+" : ""}$${change.toFixed(0)}${changePct != null ? ` (${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%)` : ""} since first entry`
                    : `1 week logged · add more each Friday to track growth`
                  }
                </p>
              </div>
              <Link href="/trades" className="text-[11px] text-blue-500 hover:underline flex items-center gap-1 mt-1">
                Account tab <ArrowRight size={11} />
              </Link>
            </div>
            {pts.length >= 2 ? (
              <>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={up ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={up ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={up ? "#22c55e" : "#ef4444"}
                      fill="url(#balGrad)"
                      strokeWidth={2}
                      dot={{ r: 2, fill: up ? "#22c55e" : "#ef4444", strokeWidth: 0 }}
                    />
                    <RTooltip
                      formatter={(v: number | undefined) => v != null ? [`$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Balance"] : ["—", "Balance"]}
                      labelFormatter={(l) => `Week ending ${l}`}
                      contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, color: "inherit" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex justify-between mt-1 px-0.5">
                  <span className="text-[9px] text-foreground/40">{chartData[0].date}</span>
                  {chartData.length > 2 && <span className="text-[9px] text-foreground/40">{chartData[Math.floor(chartData.length / 2)].date}</span>}
                  <span className="text-[9px] text-foreground/40">{chartData[chartData.length - 1].date}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-20 text-[11px] text-foreground/30">
                Log account values each Friday in the Account tab to build your chart
              </div>
            )}
          </div>
        );
      })()}

      {/* Market ticker cards */}
      <MarketCards />

      {/* ── VIX ── */}
      <div className="mb-6 sm:mb-8">
        <p className="text-[11px] font-bold text-foreground uppercase tracking-widest mb-3">Volatility</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <VixPanel />
          <VixPanel
            symbol="%5EINDIAVIX"
            title="India VIX"
            sublabel="NSE India Volatility Index"
            gradId="indiaVixGrad"
          />
        </div>
      </div>

      {/* ── Economic Calendar ── */}
      <EconomicCalendar />

      {/* Quick actions */}
      <SectionLabel>Quick Actions</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {QUICK.map(({ href, label, sub, color }) => (
          <Link key={href} href={href}
            className="relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white group hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-sm">
            <div className={`absolute inset-0 bg-gradient-to-br ${color}`} />
            <div className="relative">
              <p className="font-bold text-sm sm:text-base">{label}</p>
              <p className="text-[11px] text-white/70 mt-0.5">{sub}</p>
              <ArrowRight size={14} className="mt-3 opacity-70 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
