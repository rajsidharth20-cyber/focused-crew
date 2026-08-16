import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, requireUser } from "../_shared/guard.ts";

/** Buckets whose `<user-id>/...` folders belong to the deleted user. */
const USER_BUCKETS = ["avatars", "social"];

/** Tables keyed by the user that are not cleaned up by an auth.users cascade. */
const USER_TABLES = [
  "active_timers", "commitments", "daily_notes", "daily_objectives", "events",
  "google_calendar_connections", "google_calendar_sync_map", "hidden_messages",
  "notification_log", "notification_preferences", "push_subscriptions", "push_tokens",
  "study_presence", "study_sessions", "study_tags", "subjects", "user_quotes",
  "weekly_targets", "posts", "stories", "post_likes", "post_comments",
  "story_likes", "story_views", "blocks", "rate_limits",
];

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const guard = await requireUser(req, "delete_account", 3, 86400);
  if (!guard.ok) return guard.response;
  const userId = guard.ctx.userId;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // 1. Remove stored media owned by the user.
    for (const bucket of USER_BUCKETS) {
      for (const folder of ["", "posts", "stories"]) {
        const prefix = folder ? `${userId}/${folder}` : userId;
        const { data: files } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
        const paths = (files ?? []).filter(f => f.id).map(f => `${prefix}/${f.name}`);
        if (paths.length) await admin.storage.from(bucket).remove(paths);
      }
    }

    // 2. Delete owned rows, then rows where the user is a counterparty.
    for (const table of USER_TABLES) {
      await admin.from(table).delete().eq("user_id", userId);
    }
    await admin.from("messages").delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    await admin.from("friendships").delete().or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    await admin.from("group_invites").delete().or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`);
    await admin.from("blocks").delete().eq("blocked_id", userId);
    await admin.from("group_messages").delete().eq("user_id", userId);
    await admin.from("group_announcements").delete().eq("user_id", userId);
    await admin.from("group_members").delete().eq("user_id", userId);
    await admin.from("study_groups").delete().eq("owner_id", userId);
    await admin.from("reports").delete().eq("reporter_id", userId);
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    // 3. Finally remove the auth account itself.
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-account error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
