import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { loadServiceAccount, sendToToken, safeAppPath } from "../_shared/fcm.ts";
import { z } from "npm:zod@3";

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

    const parsed = z.object({ category: z.enum(CATEGORIES as [Category, ...Category[]]), userIds: z.array(z.string().uuid()).max(100), title: z.string().max(120).optional(), body: z.string().max(240).optional(), url: z.string().max(200).optional(), dedupeKey: z.string().max(200).optional() }).safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid notification request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const payload = parsed.data;
    const category: Category = payload.category;
    if (SELF_CATEGORIES.includes(category)) return new Response(JSON.stringify({ sent: 0, skipped: "backend scheduled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!CATEGORIES.includes(category)) throw new Error("Invalid category");

    const title: string = String(payload.title ?? "Focused Crew").slice(0, 120);
    const body: string = String(payload.body ?? "").slice(0, 240);
    const url = safeAppPath(payload.url);
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
      .select("user_id,push_enabled,direct_messages,group_messages,friend_requests,group_invites,mentions")
      .in("user_id", authorized);
    const prefMap = new Map((prefs ?? []).map((p: any) => [p.user_id, p]));
    const allowed = authorized.filter((id) => {
      const p = prefMap.get(id);
      if (!p) return true;
      return p.push_enabled !== false && p[category] !== false;
    });

    const sa = loadServiceAccount();

    let sent = 0;


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

      for (const { token } of tokens) {
        const result = await sendToToken(sa, token, { title, body, url, category, tag: dedupeKey });
        if (result.outcome === "ok") sent++;
        if (result.outcome === "invalid_token") await admin.from("push_tokens").delete().eq("user_id", userId).eq("token", token);
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push failed");
    return new Response(JSON.stringify({ error: "Notification delivery failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
