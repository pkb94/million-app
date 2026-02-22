"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";
import { GexResult, FlowByExpiry, TopFlowStrike } from "@/lib/api";

interface Props {
  data: GexResult;
  accentColor?: string;
}

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtAxis(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return `${n}`;
}

const CALL_COLOR = "#34d399"; // emerald-400
const PUT_COLOR  = "#f87171"; // red-400

// Custom tooltip shared by both charts
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 text-[11px] shadow-xl">
      <p className="text-white/60 mb-1 font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill ?? p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function NetFlowPanel({ data }: Props) {
  const {
    call_premium = 0,
    put_premium  = 0,
    net_flow     = 0,
    flow_by_expiry   = [],
    top_flow_strikes = [],
  } = data;

  const total      = call_premium + put_premium;
  const callPct    = total > 0 ? (call_premium / total) * 100 : 50;
  const putPct     = 100 - callPct;
  const isCallBias = net_flow >= 0;

  // ── Flow-by-expiry chart data (nearest 8, sorted) ────────────────────────
  const expiryChartData = useMemo(() => {
    return [...flow_by_expiry]
      .sort((a, b) => a.expiry.localeCompare(b.expiry))
      .slice(0, 8)
      .map((row) => ({
        expiry: row.expiry,
        Calls:  row.call_prem,
        Puts:   row.put_prem,
        Net:    row.net,
      }));
  }, [flow_by_expiry]);

  // ── Top-strikes chart data (top 10, sorted by strike price) ─────────────
  const strikesChartData = useMemo(() => {
    return [...top_flow_strikes]
      .sort((a, b) => a.strike - b.strike)
      .map((s) => ({
        strike: s.strike.toLocaleString(),
        Calls:  s.call_prem,
        Puts:   s.put_prem,
        Net:    s.net,
        bias:   s.bias,
      }));
  }, [top_flow_strikes]);

  // ── Table data (sorted by total premium desc) ────────────────────────────
  const sortedStrikes: TopFlowStrike[] = useMemo(() => {
    return [...top_flow_strikes].sort(
      (a, b) => b.call_prem + b.put_prem - (a.call_prem + a.put_prem)
    );
  }, [top_flow_strikes]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-5">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80 tracking-wide uppercase">
          Net Options Flow
        </h3>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isCallBias
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {isCallBias ? "▲ CALL BIAS" : "▼ PUT BIAS"}
        </span>
      </div>

      {/* ── Total premium cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
          <p className="text-[10px] text-emerald-400/70 uppercase font-semibold mb-0.5">Call Premium</p>
          <p className="text-sm font-bold text-emerald-400">{fmt(call_premium)}</p>
        </div>
        <div className={`rounded-lg border p-2 ${isCallBias ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
          <p className={`text-[10px] uppercase font-semibold mb-0.5 ${isCallBias ? "text-emerald-400/70" : "text-red-400/70"}`}>
            Net Flow
          </p>
          <p className={`text-sm font-bold ${isCallBias ? "text-emerald-400" : "text-red-400"}`}>
            {fmt(net_flow)}
          </p>
        </div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2">
          <p className="text-[10px] text-red-400/70 uppercase font-semibold mb-0.5">Put Premium</p>
          <p className="text-sm font-bold text-red-400">{fmt(put_premium)}</p>
        </div>
      </div>

      {/* ── Call / Put split bar ──────────────────────────────────────────── */}
      <div>
        <div className="flex justify-between text-[10px] text-white/50 mb-1">
          <span>Calls {callPct.toFixed(1)}%</span>
          <span>Puts {putPct.toFixed(1)}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${callPct}%` }} />
          <div className="bg-red-500   transition-all duration-500" style={{ width: `${putPct}%` }} />
        </div>
      </div>

      {/* ── Flow by Expiry — grouped bar chart ───────────────────────────── */}
      {expiryChartData.length > 0 && (
        <div>
          <p className="text-[10px] text-white/40 uppercase font-semibold mb-3">
            Flow by Expiry
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={expiryChartData} barCategoryGap="25%" barGap={2}
              margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="expiry"
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtAxis}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend
                wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.4)", paddingTop: 6 }}
                iconType="square"
                iconSize={8}
              />
              <Bar dataKey="Calls" fill={CALL_COLOR} radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="Puts"  fill={PUT_COLOR}  radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Net flow per strike — diverging bar chart ────────────────────── */}
      {strikesChartData.length > 0 && (
        <div>
          <p className="text-[10px] text-white/40 uppercase font-semibold mb-3">
            Net Flow by Strike
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={strikesChartData} layout="vertical"
              margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis
                type="number"
                tickFormatter={fmtAxis}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="strike"
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
              <Bar dataKey="Net" radius={[0, 3, 3, 0]} maxBarSize={16}>
                {strikesChartData.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.Net >= 0 ? CALL_COLOR : PUT_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top flow strikes table ────────────────────────────────────────── */}
      {sortedStrikes.length > 0 && (
        <div>
          <p className="text-[10px] text-white/40 uppercase font-semibold mb-2">
            Top Flow Strikes
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="text-left   py-1 pr-2 font-medium">Strike</th>
                  <th className="text-right  py-1 pr-2 font-medium text-emerald-400/60">Call $</th>
                  <th className="text-right  py-1 pr-2 font-medium text-red-400/60">Put $</th>
                  <th className="text-right  py-1 pr-2 font-medium">Net</th>
                  <th className="text-center py-1      font-medium">Bias</th>
                </tr>
              </thead>
              <tbody>
                {sortedStrikes.map((s) => (
                  <tr key={s.strike} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-1 pr-2 font-semibold text-white/80 tabular-nums">
                      {s.strike.toLocaleString()}
                    </td>
                    <td className="py-1 pr-2 text-right text-emerald-400 tabular-nums">{fmt(s.call_prem)}</td>
                    <td className="py-1 pr-2 text-right text-red-400    tabular-nums">{fmt(s.put_prem)}</td>
                    <td className={`py-1 pr-2 text-right tabular-nums font-medium ${s.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fmt(s.net)}
                    </td>
                    <td className="py-1 text-center">
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        s.bias === "call"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20  text-red-400"
                      }`}>
                        {s.bias.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
