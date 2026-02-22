"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGex, GexResult } from "@/lib/api";
import GexStrikeTable from "@/components/gex/GexStrikeTable";
import { fmtGex as fmtGexUtil } from "@/lib/gex";
import { Search, TrendingUp, GitCompare, X, Plus } from "lucide-react";
import { PageHeader, SkeletonStatGrid, ErrorBanner, RefreshButton } from "@/components/ui";

const STRIKE_OPTIONS = [10, 20, 30, 40, 50] as const;
const ACCENT_A = "#a855f7"; // purple
const ACCENT_B = "#f59e0b"; // amber

function SummaryCards({ data }: { data: GexResult }) {
  const items = [
    { label: "Net GEX",    value: fmtGexUtil(data.net_gex),                                           pos: (data.net_gex ?? 0) >= 0 },
    { label: "Zero Gamma", value: data.zero_gamma   != null ? `$${data.zero_gamma.toFixed(2)}`   : "—", pos: null },
    { label: "Spot",       value: data.spot         != null ? `$${data.spot.toFixed(2)}`         : "—", pos: null },
    { label: "Call Wall",  value: data.max_call_wall != null ? `$${data.max_call_wall.toFixed(2)}`  : "—", pos: true  },
    { label: "Put Wall",   value: data.max_put_wall  != null ? `$${data.max_put_wall.toFixed(2)}`   : "—", pos: false },
    { label: "Max GEX",    value: data.max_gex_strike != null ? `$${data.max_gex_strike.toFixed(2)}` : "—", pos: true },
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
      {items.map(({ label, value, pos }) => (
        <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-2.5">
          <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
          <p className={`text-sm font-black ${
            pos === null ? "text-gray-900 dark:text-white" : pos ? "text-green-500" : "text-red-500"
          }`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function TickerPanel({
  label,
  ticker,
  input,
  onInputChange,
  onSearch,
  nStrikes,
  expiryFilter,
  onToggleExpiry,
  onClearExpiry,
  accentColor,
  data,
  isLoading,
  isError,
  isFetching,
  onRefresh,
}: {
  label: string;
  ticker: string;
  input: string;
  onInputChange: (v: string) => void;
  onSearch: (e: React.FormEvent) => void;
  nStrikes: number;
  expiryFilter: string[] | null;
  onToggleExpiry: (d: string) => void;
  onClearExpiry: () => void;
  accentColor: string;
  data: GexResult | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  const expiryDates: string[] = data
    ? Array.from(new Set(data.heatmap_expiries ?? [])).sort()
    : [];

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Ticker label strip */}
      <div className="flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: accentColor }} />
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</span>
        <RefreshButton onRefresh={onRefresh} isRefreshing={isFetching} />
      </div>

      {/* Search bar */}
      <form onSubmit={onSearch} className="flex items-center gap-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm focus-within:ring-2 transition"
        style={{ "--tw-ring-color": accentColor } as React.CSSProperties}
      >
        <span className="pl-4 pr-2 text-gray-400 shrink-0"><Search size={15} /></span>
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value.toUpperCase())}
          placeholder="SPY, QQQ, AAPL…"
          className="flex-1 py-2.5 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
        />
        <button
          type="submit"
          className="m-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold tracking-wide transition flex items-center gap-1.5 shrink-0"
          style={{ background: accentColor }}
        >
          <TrendingUp size={13} />
          Load
        </button>
      </form>

      {/* States */}
      {isLoading && <SkeletonStatGrid count={6} />}
      {isError && (
        <ErrorBanner message={`Failed to load GEX for ${ticker}.`} />
      )}

      {data && (
        <>
          <SummaryCards data={data} />

          {/* Expiry filter chips */}
          {expiryDates.length > 1 && (
            <div className="mb-1">
              <p className="text-xs text-gray-400 mb-1.5">Filter by expiry</p>
              <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={onClearExpiry}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition shrink-0 ${
                    expiryFilter === null ? "text-white" : "bg-[var(--surface-2)] text-gray-600 dark:text-gray-300"
                  }`}
                  style={expiryFilter === null ? { background: accentColor } : undefined}
                >All</button>
                {expiryDates.map((d) => (
                  <button key={d} onClick={() => onToggleExpiry(d)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition shrink-0 ${
                      expiryFilter?.includes(d) ? "text-white" : "bg-[var(--surface-2)] text-gray-600 dark:text-gray-300"
                    }`}
                    style={expiryFilter?.includes(d) ? { background: accentColor } : undefined}
                  >{d}</button>
                ))}
              </div>
            </div>
          )}

          {/* Strike table */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Strike-Level GEX — <span style={{ color: accentColor }}>{ticker}</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <GexStrikeTable data={data} nStrikes={nStrikes} expiryFilter={expiryFilter} accentColor={accentColor} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function OptionsFlowPage() {
  // ── Ticker A (primary) ────────────────────────────────────────────────────
  const [tickerA, setTickerA]     = useState("SPY");
  const [inputA, setInputA]       = useState("SPY");
  const [expiryA, setExpiryA]     = useState<string[] | null>(null);

  // ── Ticker B (compare) ────────────────────────────────────────────────────
  const [compareMode, setCompare] = useState(false);
  const [tickerB, setTickerB]     = useState("QQQ");
  const [inputB, setInputB]       = useState("QQQ");
  const [expiryB, setExpiryB]     = useState<string[] | null>(null);

  // ── Shared controls ───────────────────────────────────────────────────────
  const [nStrikes, setNStrikes]   = useState<number>(20);

  const qA = useQuery<GexResult>({
    queryKey: ["gex", tickerA],
    queryFn:  () => fetchGex(tickerA),
    staleTime: 30_000,
  });
  const qB = useQuery<GexResult>({
    queryKey: ["gex", tickerB],
    queryFn:  () => fetchGex(tickerB),
    staleTime: 30_000,
    enabled: compareMode,
  });

  const handleSearchA = (e: React.FormEvent) => {
    e.preventDefault();
    const t = inputA.trim().toUpperCase();
    if (t) { setTickerA(t); setExpiryA(null); }
  };
  const handleSearchB = (e: React.FormEvent) => {
    e.preventDefault();
    const t = inputB.trim().toUpperCase();
    if (t) { setTickerB(t); setExpiryB(null); }
  };

  const toggleExpiryA = (d: string) => setExpiryA((p) => {
    if (!p) return [d];
    const next = p.includes(d) ? p.filter((x) => x !== d) : [...p, d];
    return next.length === 0 ? null : next;
  });
  const toggleExpiryB = (d: string) => setExpiryB((p) => {
    if (!p) return [d];
    const next = p.includes(d) ? p.filter((x) => x !== d) : [...p, d];
    return next.length === 0 ? null : next;
  });

  return (
    <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Options Flow"
        sub={compareMode ? `Comparing ${tickerA} vs ${tickerB}` : `GEX analysis — ${tickerA}`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompare((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                compareMode
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-[var(--surface)] text-gray-500 dark:text-gray-400 border-[var(--border)] hover:border-purple-400 hover:text-purple-500"
              }`}
            >
              {compareMode ? <X size={13} /> : <GitCompare size={13} />}
              {compareMode ? "Exit Compare" : "Compare"}
            </button>
          </div>
        }
      />

      {/* Shared strikes control */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">Strikes</span>
        <div className="flex items-center bg-[var(--surface-2)] rounded-xl p-0.5 gap-0.5">
          {STRIKE_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setNStrikes(n)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                nStrikes === n
                  ? "bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >{n}</button>
          ))}
        </div>
        {!compareMode && (
          <button
            onClick={() => setCompare(true)}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-400 border border-dashed border-[var(--border)] hover:border-amber-400 hover:text-amber-500 transition"
          >
            <Plus size={12} /> Add ticker to compare
          </button>
        )}
      </div>

      {/* Panels */}
      <div className={`grid gap-6 ${compareMode ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        <TickerPanel
          label="Ticker A"
          ticker={tickerA}
          input={inputA}
          onInputChange={setInputA}
          onSearch={handleSearchA}
          nStrikes={nStrikes}
          expiryFilter={expiryA}
          onToggleExpiry={toggleExpiryA}
          onClearExpiry={() => setExpiryA(null)}
          accentColor={ACCENT_A}
          data={qA.data}
          isLoading={qA.isLoading}
          isError={qA.isError}
          isFetching={qA.isFetching}
          onRefresh={qA.refetch}
        />

        {compareMode && (
          <TickerPanel
            label="Ticker B"
            ticker={tickerB}
            input={inputB}
            onInputChange={setInputB}
            onSearch={handleSearchB}
            nStrikes={nStrikes}
            expiryFilter={expiryB}
            onToggleExpiry={toggleExpiryB}
            onClearExpiry={() => setExpiryB(null)}
            accentColor={ACCENT_B}
            data={qB.data}
            isLoading={qB.isLoading}
            isError={qB.isError}
            isFetching={qB.isFetching}
            onRefresh={qB.refetch}
          />
        )}
      </div>
    </div>
  );
}

  const [input, setInput]         = useState("SPY");
  const [nStrikes, setNStrikes]   = useState<number>(20);
  const [expiryFilter, setExpiry] = useState<string[] | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<GexResult>({
    queryKey: ["gex", ticker],
    queryFn:  () => fetchGex(ticker),
    staleTime: 30_000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim().toUpperCase();
    if (t) { setTicker(t); setExpiry(null); }
  };

  const expiryDates: string[] = data
    ? Array.from(new Set(data.heatmap_expiries ?? [])).sort()
    : [];

  const summaryItems = data ? [
    { label: "Net GEX",     value: fmtGexUtil(data.net_gex),           pos: (data.net_gex ?? 0) >= 0 },
    { label: "Zero Gamma",  value: data.zero_gamma  != null ? `$${data.zero_gamma.toFixed(2)}`  : "—", pos: null },
    { label: "Spot",        value: data.spot        != null ? `$${data.spot.toFixed(2)}`        : "—", pos: null },
    { label: "Call Wall",   value: data.max_call_wall != null ? `$${data.max_call_wall.toFixed(2)}` : "—", pos: true  },
    { label: "Put Wall",    value: data.max_put_wall  != null ? `$${data.max_put_wall.toFixed(2)}`  : "—", pos: false },
    { label: "Max GEX",     value: data.max_gex_strike != null ? `$${data.max_gex_strike.toFixed(2)}` : "—", pos: true },
  ] : [];

  const toggleExpiry = (d: string) => {
    setExpiry((prev) => {
      if (!prev) return [d];
      const has = prev.includes(d);
      const next = has ? prev.filter((x) => x !== d) : [...prev, d];
      return next.length === 0 ? null : next;
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto">
      <PageHeader title="Options Flow" sub={`GEX analysis — ${ticker}`}
        action={<RefreshButton onRefresh={refetch} isRefreshing={isFetching} />}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Ticker search — pill style */}
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition">
          <span className="pl-4 pr-2 text-gray-400 shrink-0">
            <Search size={15} />
          </span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="SPY, QQQ, AAPL…"
            className="flex-1 py-2.5 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
          />
          <button
            type="submit"
            className="m-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold tracking-wide transition flex items-center gap-1.5 shrink-0"
          >
            <TrendingUp size={13} />
            Load
          </button>
        </form>

        {/* Strikes — segmented pill group */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide shrink-0">Strikes</span>
          <div className="flex items-center bg-[var(--surface-2)] rounded-xl p-0.5 gap-0.5">
            {STRIKE_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setNStrikes(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  nStrikes === n
                    ? "bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* States */}
      {isLoading && <SkeletonStatGrid count={6} />}
      {isError && (
        <ErrorBanner message={`Failed to load GEX data. Make sure the backend is running and ${ticker} is a valid symbol.`} />
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {summaryItems.map(({ label, value, pos }) => (
              <div key={label} className="card-hover bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3.5">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`text-lg font-black ${
                  pos === null
                    ? "text-gray-900 dark:text-white"
                    : pos
                      ? "text-green-500"
                      : "text-red-500"
                }`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Expiry filter chips */}
          {expiryDates.length > 1 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">Filter by expiry</p>
              <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setExpiry(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
                    expiryFilter === null
                      ? "bg-purple-600 text-white"
                      : "bg-[var(--surface-2)] text-gray-600 dark:text-gray-300 hover:bg-[var(--surface-2)]"
                  }`}>
                  All
                </button>
                {expiryDates.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleExpiry(d)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
                      expiryFilter?.includes(d)
                        ? "bg-purple-600 text-white"
                        : "bg-[var(--surface-2)] text-gray-600 dark:text-gray-300 hover:bg-[var(--surface-2)]"
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Strike table */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Strike-Level GEX — {ticker}</h2>
            </div>
            <div className="overflow-x-auto">
              <GexStrikeTable data={data} nStrikes={nStrikes} expiryFilter={expiryFilter} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
