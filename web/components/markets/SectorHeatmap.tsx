"use client";
/**
 * SectorHeatmap — shows a grid of tiles for a sector's key stocks.
 * Each tile is colored green/red by daily % change.
 * Size is proportional to market cap weight (relative within the sector).
 */

import { useEffect, useState, useCallback } from "react";

interface StockTile {
  symbol: string;
  name:   string;
  weight: number; // relative weight for tile sizing (1-10)
}

interface Quote {
  price:     number | null;
  change:    number | null;
  changePct: number | null;
}

type QuoteMap = Record<string, Quote>;

// ── Sector definitions ─────────────────────────────────────────────────────────

export type SectorKey =
  | "mag7" | "technology" | "finance" | "consumer"
  | "media" | "healthcare" | "telecom" | "energy";

export const SECTORS: Record<SectorKey, { label: string; stocks: StockTile[] }> = {
  mag7: {
    label: "Magnificent 7",
    stocks: [
      { symbol: "AAPL",  name: "Apple",      weight: 9 },
      { symbol: "MSFT",  name: "Microsoft",  weight: 9 },
      { symbol: "NVDA",  name: "Nvidia",     weight: 8 },
      { symbol: "GOOGL", name: "Alphabet",   weight: 8 },
      { symbol: "AMZN",  name: "Amazon",     weight: 8 },
      { symbol: "META",  name: "Meta",       weight: 7 },
      { symbol: "TSLA",  name: "Tesla",      weight: 6 },
    ],
  },
  technology: {
    label: "Technology",
    stocks: [
      { symbol: "AAPL",  name: "Apple",     weight: 9 },
      { symbol: "MSFT",  name: "Microsoft", weight: 9 },
      { symbol: "NVDA",  name: "Nvidia",    weight: 8 },
      { symbol: "AVGO",  name: "Broadcom",  weight: 6 },
      { symbol: "AMD",   name: "AMD",       weight: 5 },
      { symbol: "INTC",  name: "Intel",     weight: 4 },
      { symbol: "QCOM",  name: "Qualcomm",  weight: 4 },
      { symbol: "CRM",   name: "Salesforce",weight: 4 },
      { symbol: "ORCL",  name: "Oracle",    weight: 5 },
      { symbol: "TSM",   name: "TSMC",      weight: 7 },
    ],
  },
  finance: {
    label: "Financials",
    stocks: [
      { symbol: "JPM",  name: "JPMorgan",    weight: 9 },
      { symbol: "BAC",  name: "Bank of Am.", weight: 7 },
      { symbol: "GS",   name: "Goldman",     weight: 6 },
      { symbol: "MS",   name: "Morgan St.",  weight: 6 },
      { symbol: "WFC",  name: "Wells Fargo", weight: 6 },
      { symbol: "BRK-B",name: "Berkshire",   weight: 8 },
      { symbol: "BLK",  name: "BlackRock",   weight: 5 },
      { symbol: "V",    name: "Visa",        weight: 7 },
      { symbol: "MA",   name: "Mastercard",  weight: 7 },
      { symbol: "PYPL", name: "PayPal",      weight: 4 },
    ],
  },
  consumer: {
    label: "Consumer",
    stocks: [
      { symbol: "AMZN", name: "Amazon",     weight: 9 },
      { symbol: "WMT",  name: "Walmart",    weight: 7 },
      { symbol: "COST", name: "Costco",     weight: 6 },
      { symbol: "TGT",  name: "Target",     weight: 5 },
      { symbol: "NKE",  name: "Nike",       weight: 5 },
      { symbol: "MCD",  name: "McDonald's", weight: 6 },
      { symbol: "SBUX", name: "Starbucks",  weight: 5 },
      { symbol: "PG",   name: "P&G",        weight: 6 },
      { symbol: "KO",   name: "Coca-Cola",  weight: 5 },
      { symbol: "PEP",  name: "PepsiCo",    weight: 5 },
    ],
  },
  media: {
    label: "Media & Entertainment",
    stocks: [
      { symbol: "GOOGL", name: "Alphabet",  weight: 9 },
      { symbol: "META",  name: "Meta",      weight: 9 },
      { symbol: "NFLX",  name: "Netflix",   weight: 7 },
      { symbol: "DIS",   name: "Disney",    weight: 6 },
      { symbol: "SPOT",  name: "Spotify",   weight: 5 },
      { symbol: "PARA",  name: "Paramount", weight: 3 },
      { symbol: "WBD",   name: "WBDiscov.", weight: 3 },
      { symbol: "TTWO",  name: "Take-Two",  weight: 3 },
      { symbol: "EA",    name: "EA Sports", weight: 3 },
    ],
  },
  healthcare: {
    label: "Healthcare",
    stocks: [
      { symbol: "UNH",  name: "UnitedHlth", weight: 9 },
      { symbol: "JNJ",  name: "J&J",        weight: 8 },
      { symbol: "LLY",  name: "Eli Lilly",  weight: 8 },
      { symbol: "ABBV", name: "AbbVie",     weight: 6 },
      { symbol: "MRK",  name: "Merck",      weight: 6 },
      { symbol: "PFE",  name: "Pfizer",     weight: 5 },
      { symbol: "AMGN", name: "Amgen",      weight: 5 },
      { symbol: "TMO",  name: "Thermo F.",  weight: 5 },
      { symbol: "ABT",  name: "Abbott",     weight: 5 },
      { symbol: "CVS",  name: "CVS",        weight: 4 },
    ],
  },
  telecom: {
    label: "Telecom",
    stocks: [
      { symbol: "T",    name: "AT&T",      weight: 8 },
      { symbol: "VZ",   name: "Verizon",   weight: 8 },
      { symbol: "TMUS", name: "T-Mobile",  weight: 7 },
      { symbol: "CHTR", name: "Charter",   weight: 5 },
      { symbol: "CMCSA",name: "Comcast",   weight: 6 },
    ],
  },
  energy: {
    label: "Energy",
    stocks: [
      { symbol: "XOM",  name: "ExxonMobil",weight: 9 },
      { symbol: "CVX",  name: "Chevron",   weight: 8 },
      { symbol: "COP",  name: "ConocoPhil",weight: 6 },
      { symbol: "SLB",  name: "SLB",       weight: 5 },
      { symbol: "EOG",  name: "EOG Res.",  weight: 5 },
      { symbol: "PSX",  name: "Phillips66",weight: 4 },
      { symbol: "MPC",  name: "Marathon",  weight: 4 },
      { symbol: "OXY",  name: "Occidental",weight: 4 },
    ],
  },
};

// ── Color helpers ──────────────────────────────────────────────────────────────

function pctColor(pct: number | null): string {
  if (pct == null) return "bg-gray-800/60 text-gray-400";
  if (pct >  4)  return "bg-green-700 text-white";
  if (pct >  2)  return "bg-green-600 text-white";
  if (pct >  0.5)return "bg-green-500/80 text-white";
  if (pct > -0.5)return "bg-gray-700/60 text-gray-300";
  if (pct > -2)  return "bg-red-500/80 text-white";
  if (pct > -4)  return "bg-red-600 text-white";
  return              "bg-red-700 text-white";
}

function borderColor(pct: number | null): string {
  if (pct == null) return "border-gray-700/30";
  if (pct > 0.5)  return "border-green-500/30";
  if (pct < -0.5) return "border-red-500/30";
  return "border-gray-600/30";
}

// ── Quote fetching ─────────────────────────────────────────────────────────────

async function fetchQuotes(symbols: string[]): Promise<QuoteMap> {
  // fetch in batches of 20 to stay within backend limit
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += 20) batches.push(symbols.slice(i, i + 20));
  const all: QuoteMap = {};
  await Promise.all(batches.map(async (batch) => {
    const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(batch.join(","))}`, { cache: "no-store" });
    if (!res.ok) return;
    const rows: { symbol: string; price: number | null; change: number | null; change_pct: number | null }[] = await res.json();
    for (const r of rows) all[r.symbol] = { price: r.price, change: r.change, changePct: r.change_pct };
  }));
  return all;
}

// ── Single sector heatmap card ────────────────────────────────────────────────

interface Props {
  sector:   SectorKey;
  quotes:   QuoteMap;
  loading?: boolean;
}

export function SectorCard({ sector, quotes, loading }: Props) {
  const { label, stocks } = SECTORS[sector];
  const totalWeight = stocks.reduce((s, x) => s + x.weight, 0);

  // Sector avg change
  const changes = stocks
    .map((s) => quotes[s.symbol]?.changePct)
    .filter((v): v is number => v != null);
  const avgChange = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 sm:p-4 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        {avgChange != null && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pctColor(avgChange)}`}>
            {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Tiles grid — sized by weight */}
      <div className="flex flex-wrap gap-1">
        {stocks.map((stock) => {
          const q    = quotes[stock.symbol];
          const pct  = q?.changePct ?? null;
          const size = Math.round((stock.weight / totalWeight) * 100);
          return (
            <div
              key={stock.symbol}
              title={`${stock.name} (${stock.symbol})\n${pct != null ? (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%" : "—"}\n${q?.price != null ? "$" + q.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}`}
              style={{ flexBasis: `${Math.max(size, 10)}%` }}
              className={`flex-grow rounded-lg border p-1.5 cursor-default transition-all hover:brightness-110 hover:scale-[1.03] ${pctColor(pct)} ${borderColor(pct)} ${loading ? "animate-pulse" : ""}`}
            >
              <p className="text-[9px] font-bold leading-none truncate opacity-90">{stock.symbol}</p>
              {pct != null ? (
                <p className="text-[9px] font-semibold mt-0.5 leading-none opacity-80">
                  {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                </p>
              ) : (
                <p className="text-[9px] opacity-40 mt-0.5">—</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Full heatmap grid (all sectors) ───────────────────────────────────────────

export default function SectorHeatmaps() {
  const [quotes, setQuotes]   = useState<QuoteMap>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLast]= useState<Date | null>(null);
  const [error, setError]     = useState(false);

  const allSymbols = Array.from(
    new Set(Object.values(SECTORS).flatMap((s) => s.stocks.map((x) => x.symbol)))
  );

  const load = useCallback(async () => {
    try {
      setError(false);
      const map = await fetchQuotes(allSymbols);
      setQuotes(map);
      setLast(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Sector Heatmaps</p>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-gray-400">
              {lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button onClick={load} className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold transition">↻ Refresh</button>
        </div>
      </div>
      {error && <p className="text-xs text-red-400 mb-2">Could not load quote data — will retry automatically.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {(Object.keys(SECTORS) as SectorKey[]).map((key) => (
          <SectorCard key={key} sector={key} quotes={quotes} loading={loading && Object.keys(quotes).length === 0} />
        ))}
      </div>
    </div>
  );
}
