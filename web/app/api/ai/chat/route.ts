import { NextRequest } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

// ── Fetch portfolio context from the FastAPI backend (server-side) ────────────
async function fetchContext(accessToken: string) {
  const base = process.env.BACKEND_URL ?? "http://localhost:8000";
  const headers = { Authorization: `Bearer ${accessToken}` };

  const [positions, holdings, summary, premDash] = await Promise.allSettled([
    fetch(`${base}/portfolio/weeks`, { headers }).then((r) => r.json()),
    fetch(`${base}/holdings`, { headers }).then((r) => r.json()),
    fetch(`${base}/portfolio/summary`, { headers }).then((r) => r.json()),
    fetch(`${base}/portfolio/premium-dashboard`, { headers }).then((r) => r.json()),
  ]);

  // Pull the latest ACTIVE (non-complete) week's positions, fall back to most recent
  let latestPositions: unknown[] = [];
  if (positions.status === "fulfilled" && Array.isArray(positions.value)) {
    const weeks = positions.value as { id: number; label: string; is_complete: boolean }[];
    const activeWeek = weeks.slice().reverse().find((w) => !w.is_complete) ?? weeks[weeks.length - 1];
    if (activeWeek) {
      const pos = await fetch(`${base}/portfolio/weeks/${activeWeek.id}/positions`, { headers });
      latestPositions = await pos.json();
    }
  }

  return {
    holdings: holdings.status === "fulfilled" ? holdings.value : [],
    positions: latestPositions,
    summary: summary.status === "fulfilled" ? summary.value : null,
    premiumDashboard: premDash.status === "fulfilled" ? premDash.value : null,
  };
}

function buildSystemPrompt(ctx: Awaited<ReturnType<typeof fetchContext>>) {
  const { holdings, positions, summary, premiumDashboard } = ctx;

  const holdingLines = Array.isArray(holdings)
    ? holdings
        .map(
          (h: { symbol: string; shares: number; cost_basis: number; live_adj_basis: number }) =>
            `  - ${h.symbol}: ${h.shares} shares @ $${h.cost_basis?.toFixed(2)} cost basis, live adj basis $${h.live_adj_basis?.toFixed(2)}`
        )
        .join("\n")
    : "  (none)";

  const positionLines = Array.isArray(positions)
    ? (positions as {
        symbol: string;
        option_type: string;
        strike: number;
        contracts: number;
        status: string;
        premium_in: number | null;
        expiry_date: string | null;
      }[])
        .map((p) => {
            const dte = p.expiry_date
              ? Math.round(
                  (new Date(p.expiry_date).getTime() - Date.now()) / 86_400_000
                )
              : null;
            return `  - ${p.symbol} $${p.strike} ${p.option_type} x${p.contracts} [${p.status}] prem=$${p.premium_in ?? "?"} DTE=${dte ?? "?"}`;
          }
        )
        .join("\n")
    : "  (none)";

  const summaryText = summary
    ? `Total premium collected: $${summary.total_premium_collected?.toFixed(2)}, Win rate: ${(summary.win_rate * 100)?.toFixed(1)}%, Active positions: ${summary.active_positions}`
    : "(not available)";

  const grandTotal = premiumDashboard?.grand_total;
  const premText = grandTotal
    ? `Realized: $${grandTotal.realized_premium?.toFixed(2)}, In-flight: $${grandTotal.unrealized_premium?.toFixed(2)}, Total sold: $${grandTotal.total_premium_sold?.toFixed(2)}`
    : "(not available)";

  return `You are an AI trading assistant embedded in OptionFlow, a personal options trading journal and analytics app.

The user trades weekly options — primarily cash-secured puts (CSPs) and covered calls (CCs) — as a premium income strategy to reduce cost basis on stock holdings.

## Current Portfolio Context

### Holdings (stocks owned):
${holdingLines}

### Current Week Positions (options):
${positionLines}

### Portfolio Summary:
${summaryText}

### Premium Ledger:
${premText}

## Your Role
- Analyze positions, suggest roll/close decisions, flag risk
- Answer questions about P&L, ROI, DTE urgency, coverage
- Suggest new strikes/expirations given their portfolio
- Be concise and specific — use the data above, not generic advice
- Always acknowledge you can't see real-time market prices unless told
- Never recommend specific buy/sell orders as financial advice — frame as analysis only

Today's date: ${new Date().toISOString().slice(0, 10)}`;
}

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Support up to 3 Gemini keys for rotation when one hits quota
  const geminiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean) as string[];
  const geminiKey = geminiKeys[0]; // kept for backward compat checks below
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKeys.length === 0 && !openaiKey) {
    return new Response(
      JSON.stringify({ error: "No AI key configured. Add GEMINI_API_KEY (free) or OPENAI_API_KEY to web/.env.local" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, accessToken } = await req.json();

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch live portfolio context
  let ctx;
  try {
    ctx = await fetchContext(accessToken);
  } catch {
    ctx = { holdings: [], positions: [], summary: null, premiumDashboard: null };
  }

  const systemPrompt = buildSystemPrompt(ctx);

  // ── Gemini (free tier — preferred, tries all configured keys) ───────────────
  if (geminiKeys.length > 0) {
    // Build shared history/message once
    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const lastUserMessage: string = messages[messages.length - 1]?.content ?? "";

    let lastQuotaRetry = 0;
    for (let i = 0; i < geminiKeys.length; i++) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKeys[i]);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        const chat = model.startChat({
          history,
          systemInstruction: { role: "user", parts: [{ text: systemPrompt }] },
        });
        const result = await chat.sendMessageStream(lastUserMessage);
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            for await (const chunk of result.stream) {
              const text = chunk.text();
              if (text) controller.enqueue(encoder.encode(text));
            }
            controller.close();
          },
        });
        return new Response(readable, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      } catch (err: unknown) {
        const msg = (err as Error).message ?? "Gemini error";
        const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests");
        if (isQuota) {
          const retryMatch = msg.match(/retry in ([\d.]+)s/i);
          lastQuotaRetry = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
          console.warn(`[AI] Gemini key ${i + 1}/${geminiKeys.length} quota exceeded, trying next key...`);
          continue; // try next key
        }
        console.error("[AI] Gemini error:", msg);
        if (!openaiKey) {
          return new Response(JSON.stringify({ error: `Gemini error: ${msg}` }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        break; // non-quota error, fall through to OpenAI
      }
    }

    // All Gemini keys exhausted by quota
    if (!openaiKey) {
      const msg = lastQuotaRetry > 0
        ? `AI quota exceeded on all keys. Resets at midnight PT.`
        : "All Gemini keys failed.";
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ── OpenAI fallback ──────────────────────────────────────────────────────────
  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      max_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const code = (err as { code?: string }).code ?? "";
    const message =
      code === "insufficient_quota"
        ? "OpenAI quota exceeded — add billing at platform.openai.com/settings/billing"
        : code === "invalid_api_key"
        ? "Invalid OpenAI API key — check OPENAI_API_KEY in web/.env.local"
        : `OpenAI error: ${(err as Error).message}`;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
