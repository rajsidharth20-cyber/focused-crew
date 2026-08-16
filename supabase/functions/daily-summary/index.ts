import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, requireUser } from "../_shared/guard.ts";

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
          {
            role: "system",
            content:
              "You are a productivity coach writing a concise daily reflection (150-220 words). Given the user's objectives, targets, and commitments, write in warm second person. Structure: 1) One-sentence acknowledgement of progress. 2) Highlight the biggest win. 3) Call out 1-2 things left undone with a specific next step. 4) End with a one-line motivating close. No markdown headers, no bullet lists — just clean paragraphs. Plain text only.",
          },
          { role: "user", content: `Here is today's snapshot as JSON:\n${JSON.stringify(state)}` },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const msg = status === 429 ? "Rate limit exceeded" : status === 402 ? "AI credits exhausted" : "AI gateway error";
      return new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const summary: string = data?.choices?.[0]?.message?.content?.trim() ?? "Keep flying. Tomorrow is another runway.";
    return new Response(JSON.stringify({ summary }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("daily-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
