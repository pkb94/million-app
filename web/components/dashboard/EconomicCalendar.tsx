"use client";
/**
 * EconomicCalendar — embeds the TradingView Economic Calendar widget.
 * Filter choices (importance + countries) persist in localStorage.
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ─── constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "econ_cal_filters";

interface Filters {
  importance: string[];   // e.g. ["-1","0","1"]
  countries:  string[];   // e.g. ["us","in","eu","gb","jp","cn"]
}

const DEFAULT_FILTERS: Filters = {
  importance: ["-1", "0", "1"],
  countries:  ["us", "in", "eu", "gb", "jp", "cn"],
};

const IMPORTANCE_OPTIONS = [
  { value: "-1", label: "Low"    },
  { value:  "0", label: "Medium" },
  { value:  "1", label: "High"   },
];

const COUNTRY_OPTIONS = [
  { value: "us", label: "🇺🇸 US" },
  { value: "in", label: "🇮🇳 IN" },
  { value: "eu", label: "🇪🇺 EU" },
  { value: "gb", label: "🇬🇧 GB" },
  { value: "jp", label: "🇯🇵 JP" },
  { value: "cn", label: "🇨🇳 CN" },
  { value: "ca", label: "🇨🇦 CA" },
  { value: "au", label: "🇦🇺 AU" },
  { value: "de", label: "🇩🇪 DE" },
];

// ─── helpers ──────────────────────────────────────────────────────────────────
function loadFilters(): Filters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<Filters>;
    return {
      importance: parsed.importance ?? DEFAULT_FILTERS.importance,
      countries:  parsed.countries  ?? DEFAULT_FILTERS.countries,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(f: Filters) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* ignore */ }
}

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

// ─── component ────────────────────────────────────────────────────────────────
export default function EconomicCalendar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filters, setFiltersRaw] = useState<Filters>(loadFilters);

  const setFilters = useCallback((f: Filters) => {
    setFiltersRaw(f);
    saveFilters(f);
  }, []);

  // Re-inject the TradingView widget whenever filters change
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const importanceFilter = filters.importance.join(",") || "-1,0,1";
    const countryFilter    = filters.countries.join(",")  || "us";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme:       "dark",
      isTransparent:    true,
      width:            "100%",
      height:           "400",
      locale:           "en",
      importanceFilter,
      countryFilter,
    });

    containerRef.current.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const pillBase = "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition cursor-pointer select-none";
  const pillOn   = "bg-white/15 border-white/20 text-white";
  const pillOff  = "bg-transparent border-white/10 text-foreground/70 hover:border-white/20 hover:text-foreground";

  return (
    <div className="mb-6 sm:mb-8">
      {/* Section title */}
      <p className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest mb-3">
        Economic Calendar
      </p>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-3 px-1">
        {/* Importance toggles */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-foreground/70 uppercase tracking-widest mr-0.5">Importance</span>
          {IMPORTANCE_OPTIONS.map(({ value, label }) => {
            const active = filters.importance.includes(value);
            return (
              <button
                key={value}
                onClick={() => setFilters({ ...filters, importance: toggle(filters.importance, value) })}
                className={`${pillBase} ${active ? pillOn : pillOff}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <span className="w-px h-4 bg-white/10" />

        {/* Country pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] text-foreground/70 uppercase tracking-widest mr-0.5">Countries</span>
          {COUNTRY_OPTIONS.map(({ value, label }) => {
            const active = filters.countries.includes(value);
            return (
              <button
                key={value}
                onClick={() => setFilters({ ...filters, countries: toggle(filters.countries, value) })}
                className={`${pillBase} ${active ? pillOn : pillOff}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Widget */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="tradingview-widget-container" ref={containerRef}>
          <div className="tradingview-widget-container__widget" />
        </div>
      </div>
    </div>
  );
}
