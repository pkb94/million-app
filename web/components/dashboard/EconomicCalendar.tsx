"use client";
/**
 * EconomicCalendar — embeds the TradingView Economic Calendar widget.
 * No API key required. Widget is loaded as an iframe from TradingView's CDN.
 */

import { useEffect, useRef } from "react";

export default function EconomicCalendar() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Clear any previous instance
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme:          "dark",
      isTransparent:       true,
      width:               "100%",
      height:              "400",
      locale:              "en",
      importanceFilter:    "-1,0,1",   // all importance levels
      countryFilter:       "us,in,eu,gb,jp,cn",
    });

    containerRef.current.appendChild(script);
  }, []);

  return (
    <div className="mb-6 sm:mb-8">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
        Economic Calendar
      </p>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {/* TradingView widget container */}
        <div className="tradingview-widget-container" ref={containerRef}>
          <div className="tradingview-widget-container__widget" />
        </div>
      </div>
    </div>
  );
}
