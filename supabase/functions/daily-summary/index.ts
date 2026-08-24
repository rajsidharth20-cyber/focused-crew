import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireUser } from "../_shared/guard.ts";

const SYSTEM = `You write the "AI Daily Review" block of a productivity report. You receive a JSON snapshot of one user's day.

Rules:
- Use ONLY facts present in the JSON. Never invent activities, attendance, emotions, achievements, or progress.
- If a value is null or empty, say so plainly or omit the point.
- No motivational fluff, no metaphors, no exaggeration. Direct, factual, second person.
- Cite concrete numbers from the data (minutes, counts, percentages).
- Never treat 0 objectives as 0% performance; say "no objectives were set".

Respond with STRICT JSON only, no markdown:
{
  "well": ["1-3 short factual sentences about what actually went well"],
  "attention": ["1-2 short sentences naming the most important gap"],
  "priority": "ONE specific actionable recommendation for tomorrow, with a number or time in it"
}`;

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = await requireUser(req, "ai_summary", 30);
  if (!guard.ok) return guard.response;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { state } = await req.json();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Snapshot JSON:\n${JSON.stringify(state)}` },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const msg = status === 429 ? "Rate limit exceeded" : status === 402 ? "AI credits exhausted" : "AI gateway error";
      return new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const raw: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let review: unknown = null;
    try {
      review = JSON.parse(jsonText);
    } catch {
      review = null;
    }

    return new Response(JSON.stringify({ review, summary: raw }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
