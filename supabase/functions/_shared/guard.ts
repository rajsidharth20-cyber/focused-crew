import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/** Origins allowed to call our edge functions (preview, published, custom domain, local dev). */
const ALLOWED_ORIGIN = /^https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|[a-z0-9-]+\.lovable\.app|[a-z0-9-]+\.lovableproject\.com|focused-crew\.lovable\.app)$/i;

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGIN.test(origin) ? origin : "https://focused-crew.lovable.app";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

export interface Guarded {
  userId: string;
  /** Client bound to the caller's JWT — every query still passes through RLS. */
  client: ReturnType<typeof createClient>;
}

/**
 * Verifies the caller is signed in and consumes one unit of their quota for
 * `action`. Returns a Response to send back when the request must be rejected.
 */
export async function requireUser(
  req: Request,
  action: string,
  limit: number,
  windowSeconds = 3600
): Promise<{ ok: true; ctx: Guarded } | { ok: false; response: Response }> {
  const cors = corsHeaders(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: json({ error: "Sign in to use this feature." }, 401) };
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    return { ok: false, response: json({ error: "Sign in to use this feature." }, 401) };
  }

  const { data: allowed } = await client.rpc("consume_rate_limit", {
    _action: action,
    _limit: limit,
    _window_seconds: windowSeconds,
  });
  if (allowed === false) {
    return { ok: false, response: json({ error: "You're going too fast — try again in a little while." }, 429) };
  }

  return { ok: true, ctx: { userId: data.user.id, client } };
}
