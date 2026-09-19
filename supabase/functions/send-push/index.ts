import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Category =
  | "direct_messages"
  | "group_messages"
  | "friend_requests"
  | "group_invites"
  | "study_reminders"
  | "streak_reminders"
  | "goal_completion"
  | "mentions"
  | "schedule_reminders"
  | "event_reminders";

const CATEGORIES: Category[] = [
  "direct_messages",
  "group_messages",
  "friend_requests",
  "group_invites",
  "study_reminders",
  "streak_reminders",
  "goal_completion",
  "mentions",
  "schedule_reminders",
  "event_reminders",
];

// Categories that are reminders to the user themselves — the caller may be a recipient.
const SELF_CATEGORIES: Category[] = [
  "schedule_reminders",
  "event_reminders",
  "study_reminders",
  "streak_reminders",
  "goal_completion",
];

/**
 * Server-side authorisation: the caller may only notify people they already
 * have a real relationship with, so nobody can push arbitrary messages or
 * links to strangers.
 */
async function isRelated(
  admin: any,
  category: Category,
  callerId: string,
  targetId: string,
): Promise<boolean> {
  if (category === "direct_messages" || category === "mentions") {
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .or(
        `and(sender_id.eq.${callerId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${callerId})`,
      );
    if ((count ?? 0) > 0) return true;
    const { count: friendCount } = await admin
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(
        `and(requester_id.eq.${callerId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${callerId})`,
      );
    return (friendCount ?? 0) > 0;
  }

  if (category === "group_messages") {
    const { data: mine } = await admin.from("group_members").select("group_id").eq("user_id", callerId);
    const groupIds = (mine ?? []).map((r: any) => r.group_id);
    if (groupIds.length === 0) return false;
    const { count } = await admin
      .from("group_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetId)
      .in("group_id", groupIds);
    return (count ?? 0) > 0;
  }

  if (category === "group_invites") {
    const { count } = await admin
      .from("group_invites")
      .select("id", { count: "exact", head: true })
      .eq("inviter_id", callerId)
      .eq("invitee_id", targetId);
    return (count ?? 0) > 0;
  }

  if (category === "friend_requests") {
    const { count } = await admin
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .or(
        `and(requester_id.eq.${callerId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${callerId})`,
      );
    return (count ?? 0) > 0;
  }

  // Self-reminder categories never target other people.
  return false;
}

// ---- Google OAuth (service account -> access token) ----
function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64url(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`)),
  );
  const jwt = `${header}.${claim}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${JSON.stringify(data)}`);
  cachedToken = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return cachedToken.token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const category: Category = payload.category;
    if (!CATEGORIES.includes(category)) throw new Error("Invalid category");

    const title: string = String(payload.title ?? "Focused Crew").slice(0, 120);
    const body: string = String(payload.body ?? "").slice(0, 240);
    const url: string = String(payload.url ?? "/");
    const dedupeBase: string = String(payload.dedupeKey ?? crypto.randomUUID());

    // Never notify the caller about their own action — except for self-reminders.
    const allowSelf = SELF_CATEGORIES.includes(category);
    const recipients: string[] = [...new Set((payload.userIds ?? []) as string[])]
      .filter((id) => id && (allowSelf ? id === caller.id : id !== caller.id));
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: "no recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Only notify people the caller actually has a relationship with.
    const authorized = allowSelf
      ? recipients
      : (await Promise.all(
        recipients.map(async (id) => (await isRelated(admin, category, caller.id, id)) ? id : null),
      )).filter((id): id is string => id !== null);

    if (authorized.length === 0) {
      return new Response(JSON.stringify({ sent: 0, skipped: "not authorized for recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Respect per-user preferences (missing row = defaults on).
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("*")
      .in("user_id", authorized);
    const prefMap = new Map((prefs ?? []).map((p: any) => [p.user_id, p]));
    const allowed = authorized.filter((id) => {
      const p = prefMap.get(id);
      if (!p) return true;
      return p.push_enabled !== false && p[category] !== false;
    });

    const sa = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") ?? "{}");
    if (!sa.client_email || !sa.private_key || !sa.project_id) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
    }

    let sent = 0;
    let accessToken: string | null = null;

    for (const userId of allowed) {
      // Deduplicate: unique dedupe_key means the same event never fires twice.
      const dedupeKey = `${userId}:${category}:${dedupeBase}`;
      const { error: logError } = await admin.from("notification_log").insert({
        user_id: userId, category, title, body, url, dedupe_key: dedupeKey,
      });
      if (logError) continue; // duplicate (or write failure) -> skip

      const { data: tokens } = await admin
        .from("push_tokens").select("token").eq("user_id", userId);
      if (!tokens?.length) continue;

      accessToken ??= await getAccessToken(sa);

      for (const { token } of tokens) {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              message: {
                token,
                data: { title, body, url, category, tag: dedupeBase },
                webpush: {
                  headers: { Urgency: "high", TTL: "86400" },
                },
              },
            }),
          },
        );
        if (res.ok) { sent++; continue; }
        const err = await res.text();
        console.error("fcm error", res.status, err);
        // Delete only tokens Firebase explicitly reports as stale. A malformed
        // message payload must not erase otherwise valid phone registrations.
        if (/UNREGISTERED|registration-token-not-registered/i.test(err)) {
          await admin.from("push_tokens").delete().eq("token", token);
        }
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
