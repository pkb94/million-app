"use client";
import { GexResult } from "@/lib/api";
import { fmtGex } from "@/lib/gex";
import { GexRegimeBadge } from "./GexRegimeBadge";

interface Props {
  data: GexResult;
  ticker: string;
}

export function GexKeyLevels({ data, ticker }: Props) {
  const netGex = data.net_gex ?? 0;
  const isCallBias = netGex >= 0;

  // Zero γ above spot → bearish resistance (red), below → bullish support (green)
  const zeroAboveSpot =
    data.zero_gamma != null && data.spot != null
      ? data.zero_gamma > data.spot
      : true;

  const impliedMove =
    data.spot && data.zero_gamma
      ? Math.abs(((data.zero_gamma - data.spot) / data.spot) * 100)
      : null;

  const G = "bg-emerald-500/8 border-emerald-500/25";
  const R = "bg-red-500/8 border-red-500/25";
  const GT = "text-emerald-400";
  const RT = "text-red-400";

  return (
    <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
      {/* Spot price + regime row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-black tabular-nums text-[var(--foreground)] leading-none">
            {data.spot != null ? `$${data.spot.toFixed(2)}` : "—"}
          </span>
          <span className="text-[11px] text-foreground font-bold tracking-wide">
            {ticker}
          </span>
        </div>
        <GexRegimeBadge netGex={netGex} />
        {impliedMove != null && (
          <span className="text-[9px] text-foreground border border-foreground/20 rounded-full px-2.5 py-1 font-bold tracking-wide">
            {impliedMove.toFixed(1)}% to zero-γ
          </span>
        )}
      </div>

      {/* Key level cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {/* Net GEX — green if call bias, red if put bias */}
        <div className={`rounded-xl border px-2.5 py-2 ${isCallBias ? G : R}`}>
          <p className="text-[8px] text-foreground/70 uppercase tracking-widest font-bold mb-1">
            Net GEX
          </p>
          <p className={`text-[13px] font-black tabular-nums leading-none ${isCallBias ? GT : RT}`}>
            {fmtGex(netGex)}
          </p>
        </div>

        {/* Zero Gamma — red if above spot (resistance), green if below (support) */}
        <div className={`rounded-xl border px-2.5 py-2 ${zeroAboveSpot ? R : G}`}>
          <p className="text-[8px] text-foreground/70 uppercase tracking-widest font-bold mb-1">
            Zero γ
          </p>
          <p className={`text-[13px] font-black tabular-nums leading-none ${zeroAboveSpot ? RT : GT}`}>
            {data.zero_gamma != null ? `$${data.zero_gamma.toFixed(0)}` : "—"}
          </p>
        </div>

        {/* Call Wall — always green (upside resistance/target) */}
        <div className={`rounded-xl border px-2.5 py-2 ${G}`}>
          <p className="text-[8px] text-foreground/70 uppercase tracking-widest font-bold mb-1">
            Call Wall
          </p>
          <p className={`text-[13px] font-black tabular-nums leading-none ${GT}`}>
            {data.max_call_wall != null ? `$${data.max_call_wall.toFixed(0)}` : "—"}
          </p>
        </div>

        {/* Put Wall — always red (downside support/floor) */}
        <div className={`rounded-xl border px-2.5 py-2 ${R}`}>
          <p className="text-[8px] text-foreground/70 uppercase tracking-widest font-bold mb-1">
            Put Wall
          </p>
          <p className={`text-[13px] font-black tabular-nums leading-none ${RT}`}>
            {data.max_put_wall != null ? `$${data.max_put_wall.toFixed(0)}` : "—"}
          </p>
        </div>

        {/* Max GEX — green if call bias, red if put bias */}
        <div className={`rounded-xl border px-2.5 py-2 ${isCallBias ? G : R}`}>
          <p className="text-[8px] text-foreground/70 uppercase tracking-widest font-bold mb-1">
            Max GEX
          </p>
          <p className={`text-[13px] font-black tabular-nums leading-none ${isCallBias ? GT : RT}`}>
            {data.max_gex_strike != null ? `$${data.max_gex_strike.toFixed(0)}` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
