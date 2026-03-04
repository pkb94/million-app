"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSymbolSummary } from "@/lib/api";
import { EmptyState, SkeletonCard } from "@/components/ui";
import { Search } from "lucide-react";
import { inp, fmt$ } from "./TradesHelpers";

export function SymbolsTab() {
  const { data: symbols = [], isLoading } = useQuery({
    queryKey: ["symbolSummary"],
    queryFn: fetchSymbolSummary,
    staleTime: 60_000,
  });
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => symbols.filter((s) => s.symbol.toLowerCase().includes(search.toLowerCase())),
    [symbols, search],
  );

  return (
    <div>
      <div className="mb-4 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search symbol…"
          className={`${inp} pl-8`}
        />
      </div>

      {isLoading && <div className="space-y-2">{[1, 2, 3].map((i) => <SkeletonCard key={i} rows={1} />)}</div>}

      {!isLoading && filtered.length === 0 && (
        <EmptyState icon={Search} title="No symbols found" body={search ? "Try a different search." : "Your traded symbols will appear here."} />
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-[var(--border)]">
            {filtered.map((s) => (
              <div key={s.symbol} className="px-3 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-foreground text-base">{s.symbol}</span>
                  <span className={`text-sm font-bold ${s.realized_pnl >= 0 ? "text-green-500" : "text-red-500"}`}>{fmt$(s.realized_pnl)}</span>
                </div>
                <div className="flex items-center gap-4 text-sm mb-1">
                  <div>
                    <span className="text-[10px] text-foreground/40 uppercase tracking-wide block">Total Prem</span>
                    <span className="text-green-500 font-semibold">${s.total_premium.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-foreground/40 uppercase tracking-wide block">Active</span>
                    <span className="text-blue-500 font-semibold">{s.active}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-foreground/60">
                  <span>Closed: <span className="text-green-600 font-semibold">{s.closed}</span></span>
                  <span>Expired: <span className="text-foreground/50 font-semibold">{s.expired}</span></span>
                  <span>Assigned: <span className="text-yellow-500 font-semibold">{s.assigned}</span></span>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] text-foreground/60 uppercase tracking-wide bg-[var(--surface-2)]">
                  {["Symbol", "Total Premium", "Realized P/L", "Active", "Closed", "Expired", "Assigned"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.symbol} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-2.5 font-bold text-foreground">{s.symbol}</td>
                    <td className="px-4 py-2.5 text-green-500 font-semibold">${s.total_premium.toFixed(2)}</td>
                    <td className={`px-4 py-2.5 font-semibold ${s.realized_pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {fmt$(s.realized_pnl)}
                    </td>
                    <td className="px-4 py-2.5 text-blue-500 font-semibold">{s.active}</td>
                    <td className="px-4 py-2.5 text-green-600">{s.closed}</td>
                    <td className="px-4 py-2.5 text-foreground/50">{s.expired}</td>
                    <td className="px-4 py-2.5 text-yellow-500">{s.assigned}</td>
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
