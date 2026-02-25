"use client";
/**
 * VixPanel — CBOE VIX sparkline + level badge.
 * • 1D  → 1-minute bars (~390 pts), live-polls every second for latest value
 * • 2-3D → 5-minute bars
 * • 7-14D → 30-minute bars
 * • 30D → daily bars
 * Persists selected range in localStorage.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, ReferenceLine, YAxis, XAxis,
} from "recharts";
import { api } from "@/lib/api";

interface Bar { date: string; close: number; }

interface Props {
  symbol?:     string;
  title?:      string;
  sublabel?:   string;
  gradId?:     string;
  storageKey?: string;
}

type DayRange = 1 | 2 | 3 | 7 | 14 | 30;
const DAY_RANGES: DayRange[] = [1, 2, 3, 7, 14, 30];

const RANGE_CFG: Record<DayRange, { period: string; interval: string; intraday: boolean }> = {
  1:  { period: "1d",  interval: "1m",  intraday: true  },
  2:  { period: "5d",  interval: "5m",  intraday: true  },
  3:  { period: "5d",  interval: "5m",  intraday: true  },
  7:  { period: "1mo", interval: "30m", intraday: true  },
  14: { period: "1mo", interval: "30m", intraday: true  },
  30: { period: "1mo", interval: "1d",  intraday: false },
};

function vixRegime(v: number): { label: string; color: string; bg: string } {
  if (v < 15) return { label: "Low",      color: "text-green-500",  bg: "bg-green-500/10 border border-green-500/25"   };
  if (v < 20) return { label: "Normal",   color: "text-blue-500",   bg: "bg-blue-500/10 border border-blue-500/25"    };
  if (v < 30) return { label: "Elevated", color: "text-yellow-500", bg: "bg-yellow-500/10 border border-yellow-500/25" };
  if (v < 40) return { label: "High",     color: "text-orange-500", bg: "bg-orange-500/10 border border-orange-500/25" };
  return               { label: "Extreme", color: "text-red-500",    bg: "bg-red-500/10 border border-red-500/25"      };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, intraday }: any) {
  if (!active || !payload?.length) return null;
  let display = label as string;
  if (intraday && label) {
    try { display = new Date(label).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { /* keep raw */ }
  }
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs shadow-lg">
      <p className="text-foreground/70 mb-0.5">{display}</p>
      <p className="font-bold text-foreground">{Number(payload[0].value).toFixed(2)}</p>
    </div>
  );
}

export default function VixPanel({
  symbol     = "%5EVIX",
  title      = "VIX",
  sublabel   = "CBOE Volatility Index",
  gradId     = "vixGrad",
  storageKey = "vix_panel_range",
}: Props) {
  const [bars, setBars]       = useState<Bar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [days, setDaysRaw]    = useState<DayRange>(() => {
    if (typeof window === "undefined") return 1;
    const saved = localStorage.getItem(storageKey);
    return (saved && ([1,2,3,7,14,30] as number[]).includes(Number(saved)))
      ? (Number(saved) as DayRange)
      : 1;
  });

  const setDays = (d: DayRange) => {
    setDaysRaw(d);
    try { localStorage.setItem(storageKey, String(d)); } catch { /* ignore */ }
  };

  const cfg = RANGE_CFG[days];

  const load = useCallback(async (d: DayRange) => {
    const c = RANGE_CFG[d];
    try {
      setLoading(true);
      setError(false);
      const data = await api.get<{ symbol: string; bars: Bar[] }>(
        `/stocks/${symbol}/history?period=${c.period}&interval=${c.interval}`
      );
      let result = data.bars ?? [];
      // For multi-day intraday, trim to exactly N trading days
      if (c.intraday && d > 1 && result.length > 0) {
        const dayMap = new Map<string, Bar[]>();
        for (const b of result) {
          const key = b.date.slice(0, 10);
          if (!dayMap.has(key)) dayMap.set(key, []);
          dayMap.get(key)!.push(b);
        }
        const sortedDays = Array.from(dayMap.keys()).sort().slice(-d);
        result = sortedDays.flatMap((k) => dayMap.get(k)!);
      }
      setBars(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { load(days); }, [load, days]);

  // 1-second live poll for latest bar on 1D intraday view
  useEffect(() => {
    if (days !== 1) return;
    const tick = async () => {
      try {
        const data = await api.get<{ symbol: string; bars: Bar[] }>(
          `/stocks/${symbol}/history?period=1d&interval=1m`
        );
        const fresh = data.bars ?? [];
        if (!fresh.length) return;
        const last = fresh[fresh.length - 1];
        setBars((prev) => {
          if (!prev.length) return fresh;
          const existing = prev[prev.length - 1];
          if (existing.date === last.date) return [...prev.slice(0, -1), last];
          return [...prev, last];
        });
      } catch { /* silent on tick errors */ }
    };
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [symbol, days]);

  const current   = bars.length ? bars[bars.length - 1].close : null;
  const prev      = bars.length > 1 ? bars[bars.length - 2].close : null;
  const change    = current != null && prev != null ? current - prev : null;
  const changePct = change != null && prev ? (change / prev) * 100 : null;
  const up        = (change ?? 0) >= 0;
  const regime    = current != null ? vixRegime(current) : null;

  const strokeColor = current == null ? "#6b7280"
    : current < 15 ? "#22c55e"
    : current < 20 ? "#3b82f6"
    : current < 30 ? "#eab308"
    : current < 40 ? "#f97316"
    : "#ef4444";

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest">{title}</p>
          <p className="text-[10px] text-foreground/70/70 mt-0.5">{sublabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {days === 1 && !loading && !error && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          )}
          {regime && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${regime.bg} ${regime.color}`}>
              {regime.label}
            </span>
          )}
        </div>
      </div>

      {/* Current value */}
      {loading ? (
        <div className="space-y-2 mb-3">
          <div className="skeleton h-8 w-24 rounded-lg" />
          <div className="skeleton h-4 w-16 rounded-lg" />
        </div>
      ) : error || current == null ? (
        <p className="text-2xl font-black text-foreground/70 mb-3">—</p>
      ) : (
        <div className="mb-3">
          <p className="text-2xl sm:text-3xl font-black text-foreground leading-none tabular-nums">
            {current.toFixed(2)}
          </p>
          {change != null && changePct != null && (
            <p className={`text-xs font-bold mt-1 tabular-nums ${up ? "text-green-500" : "text-red-500"}`}>
              {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)} ({up ? "+" : ""}{changePct.toFixed(2)}%)
            </p>
          )}
          <p className="text-[9px] text-foreground/70 mt-0.5">{bars.length} bars · {cfg.interval} interval</p>
        </div>
      )}

      {/* Sparkline */}
      {!loading && bars.length > 1 && (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={bars} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: "#9ca3af" }}
              tickFormatter={(v: string) => {
                if (!cfg.intraday) {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }
                try {
                  return new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                } catch { return v; }
              }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={["auto", "auto"]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: "#9ca3af" }}
              tickFormatter={(v: number) => v.toFixed(0)}
              width={28}
            />
            <ReferenceLine y={20} stroke="#eab30844" strokeDasharray="3 3" />
            <ReferenceLine y={30} stroke="#f9731644" strokeDasharray="3 3" />
            <Tooltip content={<CustomTooltip intraday={cfg.intraday} />} />
            <Area
              type="monotone"
              dataKey="close"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Day-range pills + reference legend */}
      <div className="flex items-center justify-between mt-3">
        {/* Pills */}
        <div className="flex items-center gap-1">
          {DAY_RANGES.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition ${
                days === d
                  ? "bg-white/15 text-white"
                  : "text-foreground/70 hover:text-foreground hover:bg-white/10"
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
        {/* Reference lines legend */}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] text-yellow-500/80">
            <span className="inline-block w-4 border-t border-dashed border-yellow-400" />20
          </span>
          <span className="flex items-center gap-1 text-[9px] text-orange-500/80">
            <span className="inline-block w-4 border-t border-dashed border-orange-400" />30
          </span>
        </div>
      </div>
    </div>
  );
}
