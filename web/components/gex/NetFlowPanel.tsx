"use client";

import React, { useMemo, useEffect, useState, useRef } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  Legend,
} from "recharts";
import { GexResult, TopFlowStrike, api } from "@/lib/api";

interface Props {
  data: GexResult;
  accentColor?: string;
}

interface Snapshot {
  t: string;
  price: number;
  call_prem: number;
  put_prem: number;
  net_flow: number;
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

const CALL_COLOR  = "#34d399";
const PUT_COLOR   = "#f87171";
const PRICE_COLOR = "#facc15";
const NET_CALL    = "#22c55e";
const NET_PUT     = "#ef4444";

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0f1117] px-3 py-2 text-[11px] shadow-xl space-y-0.5 min-w-[160px]">
      <p className="text-white/50 font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.stroke ?? p.fill ?? p.color }}>
          {p.name}: {p.name === "Price" ? `$${Number(p.value).toFixed(2)}` : fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

function FlowGradients() {
  return (
    <defs>
      <linearGradient id="gradCall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={NET_CALL} stopOpacity={0.45} />
        <stop offset="95%" stopColor={NET_CALL} stopOpacity={0.03} />
      </linearGradient>
      <linearGradient id="gradPut" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor={NET_PUT} stopOpacity={0.03} />
        <stop offset="95%" stopColor={NET_PUT} stopOpacity={0.45} />
      </linearGradient>
    </defs>
  );
}

export default function NetFlowPanel({ data }: Props) {
  const {
    symbol,
    spot,
    call_premium     = 0,
    put_premium      = 0,
    net_flow         = 0,
    flow_by_expiry   = [],
    top_flow_strikes = [],
  } = data;

  const total      = call_premium + put_premium;
  const callPct    = total > 0 ? (call_premium / total) * 100 : 50;
  const putPct     = 100 - callPct;
  const isCallBias = net_flow >= 0;

  // ── Intraday history ────────────────────────────────────────────────────
  const [history, setHistory] = useState<Snapshot[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHistory = async () => {
    try {
      const snapshots = await api.get<Snapshot[]>(`/options/net-flow-history/${symbol}`);
      if (snapshots?.length) setHistory(snapshots);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!symbol) return;
    fetchHistory();
    timerRef.current = setInterval(fetchHistory, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // Seed with current snapshot while history loads
  const chartData: Snapshot[] = useMemo(() => {
    if (history.length > 0) return history;
    if (!spot) return [];
    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return [{ t: now, price: spot, call_prem: call_premium, put_prem: put_premium, net_flow }];
  }, [history, spot, call_premium, put_premium, net_flow]);

  const [priceMin, priceMax] = useMemo(() => {
    if (!chartData.length) return [0, 0];
    const p = chartData.map((d) => d.price);
    const mn = Math.min(...p), mx = Math.max(...p);
    const pad = (mx - mn) * 0.15 || mx * 0.005;
    return [mn - pad, mx + pad];
  }, [chartData]);

  const premDomain = useMemo((): [number, number] => {
    if (!chartData.length) return [-1, 1];
    const vals = chartData.flatMap((d) => [d.call_prem, d.put_prem]);
    const absMax = Math.max(...vals.map(Math.abs), 1);
    return [0, absMax * 1.2];
  }, [chartData]);

  // ── Expiry bar data ──────────────────────────────────────────────────────
  const expiryData = useMemo(() =>
    [...flow_by_expiry]
      .sort((a, b) => a.expiry.localeCompare(b.expiry))
      .slice(0, 8)
      .map((r) => ({ expiry: r.expiry, Calls: r.call_prem, Puts: r.put_prem })),
  [flow_by_expiry]);

  // ── Strike diverging bar data ────────────────────────────────────────────
  const strikeData = useMemo(() =>
    [...top_flow_strikes]
      .sort((a, b) => a.strike - b.strike)
      .map((s) => ({ strike: s.strike.toLocaleString(), Net: s.net, bias: s.bias })),
  [top_flow_strikes]);

  // ── Table ────────────────────────────────────────────────────────────────
  const tableStrikes: TopFlowStrike[] = useMemo(() =>
    [...top_flow_strikes].sort((a, b) => b.call_prem + b.put_prem - (a.call_prem + a.put_prem)),
  [top_flow_strikes]);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0f17] p-4 space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white/90">{symbol} Net Flow</h3>
          {spot > 0 && (
            <p className="text-[10px] text-white/40 mt-0.5 space-x-2">
              <span>Price: <span className="text-yellow-400 font-semibold">${spot.toFixed(2)}</span></span>
              <span>· NFP: <span className={isCallBias ? "text-emerald-400" : "text-red-400"}>{fmt(net_flow)}</span></span>
              <span>· NCP: <span className="text-green-400">{fmt(call_premium)}</span></span>
              <span>· {chartData.length} pts</span>
            </p>
          )}
        </div>
        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
          isCallBias ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
        }`}>
          {isCallBias ? "▲ CALL BIAS" : "▼ PUT BIAS"}
        </span>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
          <p className="text-[10px] text-emerald-400/70 uppercase font-semibold mb-0.5">Call Premium</p>
          <p className="text-sm font-bold text-emerald-400">{fmt(call_premium)}</p>
        </div>
        <div className={`rounded-lg border p-2 ${isCallBias ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
          <p className={`text-[10px] uppercase font-semibold mb-0.5 ${isCallBias ? "text-emerald-400/70" : "text-red-400/70"}`}>Net Flow</p>
          <p className={`text-sm font-bold ${isCallBias ? "text-emerald-400" : "text-red-400"}`}>{fmt(net_flow)}</p>
        </div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2">
          <p className="text-[10px] text-red-400/70 uppercase font-semibold mb-0.5">Put Premium</p>
          <p className="text-sm font-bold text-red-400">{fmt(put_premium)}</p>
        </div>
      </div>

      {/* ── Call / Put split bar ─────────────────────────────────────────── */}
      <div>
        <div className="flex justify-between text-[10px] text-white/50 mb-1">
          <span>Calls {callPct.toFixed(1)}%</span>
          <span>Puts {putPct.toFixed(1)}%</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${callPct}%` }} />
          <div className="bg-red-500   transition-all duration-500" style={{ width: `${putPct}%` }} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MAIN CHART — Unusual Whales style
          Yellow price line (left axis) + green/red premium areas (right axis)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg border border-white/5 bg-black/20 p-3">
        {/* Legend row */}
        <div className="flex items-center gap-5 mb-3">
          <span className="flex items-center gap-1.5 text-[10px] text-white/50">
            <span className="inline-block w-5 border-t-2 border-yellow-400" />
            {symbol}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-white/50">
            <span className="inline-block w-5 border-t-2 border-red-400 border-dashed" />
            Net Put Prem
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-white/50">
            <span className="inline-block w-5 border-t-2 border-green-400" />
            Net Call Prem
          </span>
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 52, left: 0, bottom: 4 }}>
            <FlowGradients />
            <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />

            <XAxis
              dataKey="t"
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              minTickGap={48}
            />

            {/* Left axis — price */}
            <YAxis
              yAxisId="price"
              orientation="left"
              domain={[priceMin, priceMax]}
              tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={54}
            />

            {/* Right axis — premium */}
            <YAxis
              yAxisId="prem"
              orientation="right"
              domain={premDomain}
              tickFormatter={fmtAxis}
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />

            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }}
            />
            <ReferenceLine yAxisId="prem" y={0} stroke="rgba(255,255,255,0.1)" />

            {/* Call premium — green area */}
            <Area
              yAxisId="prem"
              type="monotone"
              dataKey="call_prem"
              name="Net Call Prem"
              stroke={NET_CALL}
              strokeWidth={1.5}
              fill="url(#gradCall)"
              dot={false}
              activeDot={{ r: 3, fill: NET_CALL }}
              isAnimationActive={false}
            />

            {/* Put premium — red area (also positive, read from right axis) */}
            <Area
              yAxisId="prem"
              type="monotone"
              dataKey="put_prem"
              name="Net Put Prem"
              stroke={NET_PUT}
              strokeWidth={1.5}
              fill="url(#gradPut)"
              dot={false}
              activeDot={{ r: 3, fill: NET_PUT }}
              isAnimationActive={false}
            />

            {/* Price — yellow line on top */}
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="price"
              name="Price"
              stroke={PRICE_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: PRICE_COLOR }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Flow by Expiry ────────────────────────────────────────────────── */}
      {expiryData.length > 0 && (
        <div>
          <p className="text-[10px] text-white/40 uppercase font-semibold mb-3">Flow by Expiry</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={expiryData} barCategoryGap="25%" barGap={2} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="expiry" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend wrapperStyle={{ fontSize: 10, color: "rgba(255,255,255,0.4)", paddingTop: 6 }} iconType="square" iconSize={8} />
              <Bar dataKey="Calls" fill={CALL_COLOR} radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="Puts"  fill={PUT_COLOR}  radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Net Flow by Strike ────────────────────────────────────────────── */}
      {strikeData.length > 0 && (
        <div>
          <p className="text-[10px] text-white/40 uppercase font-semibold mb-3">Net Flow by Strike</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={strikeData} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tickFormatter={fmtAxis} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="strike" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
              <Bar dataKey="Net" radius={[0, 3, 3, 0]} maxBarSize={16}>
                {strikeData.map((e, i) => (
                  <Cell key={`sc-${i}`} fill={e.Net >= 0 ? CALL_COLOR : PUT_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top Flow Strikes table ────────────────────────────────────────── */}
      {tableStrikes.length > 0 && (
        <div>
          <p className="text-[10px] text-white/40 uppercase font-semibold mb-2">Top Flow Strikes</p>
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
                {tableStrikes.map((s) => (
                  <tr key={s.strike} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-1 pr-2 font-semibold text-white/80 tabular-nums">{s.strike.toLocaleString()}</td>
                    <td className="py-1 pr-2 text-right text-emerald-400 tabular-nums">{fmt(s.call_prem)}</td>
                    <td className="py-1 pr-2 text-right text-red-400    tabular-nums">{fmt(s.put_prem)}</td>
                    <td className={`py-1 pr-2 text-right tabular-nums font-medium ${s.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(s.net)}</td>
                    <td className="py-1 text-center">
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        s.bias === "call" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}>{s.bias.toUpperCase()}</span>
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
