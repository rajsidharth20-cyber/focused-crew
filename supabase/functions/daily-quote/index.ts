import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireUser } from "../_shared/guard.ts";

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = await requireUser(req, "ai_quote", 60);
  if (!guard.ok) return guard.response;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let theme = "flight";
    try {
      const body = await req.json();
      if (body?.theme) theme = body.theme;
    } catch { /* no body */ }

    const flavor = theme === "war"
      ? "tactical, disciplined, warrior-mindset (Sun Tzu, Marcus Aurelius, Musashi vibes)"
      : "aviation-flavored, calm, aspirational (pilots, sky, altitude, focus)";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You generate a single short motivational quote for a productivity app. Style: ${flavor}. Return ONLY strict JSON: {"text": string (max 140 chars), "author": string (real person or "Unknown")}. No markdown, no code fences.`,
          },
          { role: "user", content: `Give me one fresh motivational quote. Seed: ${Math.random().toString(36).slice(2)}` },
        ],
        temperature: 1,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const msg = status === 429 ? "Rate limit exceeded" : status === 402 ? "AI credits exhausted" : "AI gateway error";
      return new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    let quote = { text: "", author: "Unknown" };
    try {
      const cleaned = raw.trim().replace(/^```json\s*|\s*```$/g, "");
      quote = JSON.parse(cleaned);
    } catch {
      quote = { text: raw.slice(0, 140) || "Stay the course.", author: "Unknown" };
    }

    return new Response(JSON.stringify(quote), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-quote error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
