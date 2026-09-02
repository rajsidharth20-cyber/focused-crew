import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar.events",
];

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const CLIENT_API_KEY = Deno.env.get("GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY") ?? "";
const KEY_SECRET = Deno.env.get("APP_USER_CONNECTION_KEY_SECRET") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- encryption of the per-user connection key ----------
async function aesKey() {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(KEY_SECRET));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(plain)),
  );
  const out = new Uint8Array(iv.length + buf.length);
  out.set(iv);
  out.set(buf, iv.length);
  return btoa(String.fromCharCode(...out));
}

async function decrypt(b64: string) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = bin.slice(0, 12);
  const data = bin.slice(12);
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await aesKey(), data);
  return new TextDecoder().decode(buf);
}

// ---------- gateway helpers ----------
async function gatewayCall(connectionKey: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}/${CONNECTOR_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return res;
}

// ---------- date helpers ----------
const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

function nextOccurrence(fromISO: string, days: number[]) {
  for (let i = 0; i < 7; i++) {
    const iso = addDays(fromISO, i);
    if (days.includes(new Date(`${iso}T00:00:00`).getDay())) return iso;
  }
  return fromISO;
}

const normTime = (t: string) => (/^\d{1,2}:\d{2}$/.test(t) ? `${pad(Number(t.split(":")[0]))}:${t.split(":")[1]}` : t);

function timedEvent(date: string, start: string, end: string | null, timeZone: string) {
  const s = normTime(start);
  let e = end ? normTime(end) : null;
  if (!e || e <= s) {
    const [h, m] = s.split(":").map(Number);
    const d = new Date(2000, 0, 1, h, m + 60);
    e = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return {
    start: { dateTime: `${date}T${s}:00`, timeZone },
    end: { dateTime: `${date}T${e}:00`, timeZone },
  };
}

function allDay(date: string) {
  return { start: { date }, end: { date: addDays(date, 1) } };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body.action ?? "status");

    const loadConnection = async () => {
      const { data } = await admin
        .from("google_calendar_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    };

    // Returns the decrypted key, or null when the stored value is unusable.
    const loadKey = async (conn: { connection_key_enc?: string | null } | null) => {
      if (!conn?.connection_key_enc) return null;
      try {
        return await decrypt(conn.connection_key_enc);
      } catch (e) {
        console.error("connection key could not be decrypted", e);
        return null;
      }
    };

    // Best-effort gateway disconnect so the gateway does not keep a dangling
    // connection that later forces a reconnect we have no key for.
    const gatewayDisconnect = async (connectionKey: string) => {
      try {
        const res = await fetch(`${GATEWAY}/api/v1/app-users/connection`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": connectionKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ connector_id: CONNECTOR_ID }),
        });
        if (!res.ok) console.error(`gateway disconnect failed [${res.status}]: ${await res.text()}`);
      } catch (e) {
        console.error("gateway disconnect error", e);
      }
    };

    // Release a gateway connection when the per-user connection key is gone —
    // authenticated with the client key + app_user_id instead.
    const gatewayDisconnectByClient = async (appUserId: string) => {
      try {
        const res = await fetch(`${GATEWAY}/api/v1/app-users/connection`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Client-Api-Key": CLIENT_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ connector_id: CONNECTOR_ID, app_user_id: appUserId }),
        });
        if (!res.ok) console.error(`gateway client disconnect failed [${res.status}]: ${await res.text()}`);
        return res.ok;
      } catch (e) {
        console.error("gateway client disconnect error", e);
        return false;
      }
    };

    if (action === "status") {
      const conn = await loadConnection();
      // No row, or a placeholder row written by "start" whose OAuth flow was
      // never completed (empty key, never synced) → simply not connected.
      if (!conn || (!conn.connection_key_enc && !conn.last_synced_at)) {
        return json({ state: "disconnected", connected: false, email: null, lastSyncedAt: null });
      }
      const key = await loadKey(conn);
      if (!key) {
        return json({
          state: "reconnect_required",
          connected: false,
          email: conn.google_email ?? null,
          lastSyncedAt: conn.last_synced_at ?? null,
        });
      }
      return json({
        state: "connected",
        connected: true,
        email: conn.google_email ?? null,
        lastSyncedAt: conn.last_synced_at ?? null,
      });
    }

    if (action === "start") {
      if (!CLIENT_API_KEY) return json({ error: "Google Calendar isn't set up for this app yet." }, 500);
      const returnUrl = String(body.returnUrl ?? "");
      if (!/^https?:\/\//.test(returnUrl)) return json({ error: "Invalid return URL" }, 400);
      const conn = await loadConnection();
      let storedKey = await loadKey(conn);
      let appUserId = conn?.app_user_id || user.id;

      const authorize = async (connectionKey: string | null, asAppUserId: string) => {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Client-Api-Key": CLIENT_API_KEY,
          "Content-Type": "application/json",
        };
        // Reconnect: the gateway requires the stored per-user key as a header.
        if (connectionKey) headers["X-Connection-Api-Key"] = connectionKey;
        const res = await fetch(`${GATEWAY}/api/v1/app-users/oauth2/authorize`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            connector_id: CONNECTOR_ID,
            app_user_id: asAppUserId,
            return_url: returnUrl,
            credentials_configuration: { scopes: SCOPES },
          }),
        });
        return { res, text: await res.text() };
      };

      let { res, text } = await authorize(storedKey, appUserId);

      // Stored key is no longer valid at the gateway — retry as a first connect.
      if (!res.ok && storedKey && (res.status === 401 || res.status === 403 || res.status === 404)) {
        await admin.from("google_calendar_connections").delete().eq("user_id", user.id);
        storedKey = null;
        appUserId = user.id;
        ({ res, text } = await authorize(null, appUserId));
      }

      // The gateway still holds a connection for this user but our stored key is
      // gone/unreadable. Release it server-side, then retry as a first connect.
      if (!res.ok && !storedKey && /X-Connection-Api-Key/i.test(text)) {
        if (conn) await admin.from("google_calendar_connections").delete().eq("user_id", user.id);
        await gatewayDisconnectByClient(appUserId);
        appUserId = user.id;
        ({ res, text } = await authorize(null, appUserId));
      }

      // Still treated as a keyless reconnect: authorize under a fresh connection
      // identity so the dangling gateway record no longer collides with us.
      if (!res.ok && /X-Connection-Api-Key/i.test(text)) {
        appUserId = `${user.id}:${Date.now()}`;
        ({ res, text } = await authorize(null, appUserId));
      }

      if (!res.ok) {
        console.error(`authorize failed [${res.status}]: ${text}`);
        return json({
          error: "We couldn't open the Google sign-in window. Please try again in a moment.",
          code: "authorize_failed",
        }, 502);
      }

      // Remember the identity that worked so exchange/future reconnects reuse it.
      await admin.from("google_calendar_connections").upsert({
        user_id: user.id,
        app_user_id: appUserId,
        connection_key_enc: storedKey ? conn!.connection_key_enc : "",
        google_email: conn?.google_email ?? null,
        calendar_id: conn?.calendar_id ?? "primary",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      return json(JSON.parse(text));
    }

    if (action === "exchange") {
      const code = String(body.code ?? "");
      if (!code) return json({ error: "Missing code" }, 400);
      const res = await fetch(`${GATEWAY}/api/v1/app-users/oauth2/exchange`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Client-Api-Key": CLIENT_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`exchange failed [${res.status}]: ${text}`);
        return json({ error: "We couldn't finish connecting your Google account. Please try again." }, 502);
      }
      const data = JSON.parse(text);
      const key = data.connection_key ?? data.connection_api_key ?? data.key ?? data.api_key;
      if (!key) {
        console.error(`exchange returned no connection key: ${text}`);
        return json({
          error: "Google approved access but didn't return a usable connection. Please try connecting again.",
        }, 502);
      }

      // Verify we can actually use the user's calendar before saving.
      // NOTE: only the `calendar.events` scope is requested, which does not
      // permit calendarList.get — probe the events collection instead.
      let email: string | null = null;
      const verify = await gatewayCall(key, "/calendar/v3/calendars/primary/events?maxResults=1");
      if (!verify.ok) {
        console.error(`calendar verification failed [${verify.status}]: ${await verify.text()}`);
        return json({
          error: "Connected to Google, but we couldn't read your calendar. Please reconnect and allow calendar access.",
        }, 502);
      }
      const cal = await verify.json();
      // events.list returns the calendar's own id/summary in `summary`.
      email = typeof cal.summary === "string" && cal.summary.includes("@") ? cal.summary : null;
      const calendarId = "primary";


      const { error } = await admin.from("google_calendar_connections").upsert({
        user_id: user.id,
        connection_key_enc: await encrypt(key),
        google_email: email,
        calendar_id: calendarId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      return json({ connected: true, state: "connected", email });
    }

    if (action === "disconnect") {
      const conn = await loadConnection();
      const key = await loadKey(conn);
      // Release the connection at the gateway first so a later Connect is a
      // clean first-time authorization instead of a keyless reconnect.
      if (key) await gatewayDisconnect(key);
      await admin.from("google_calendar_connections").delete().eq("user_id", user.id);
      await admin.from("google_calendar_sync_map").delete().eq("user_id", user.id);
      return json({ connected: false, state: "disconnected" });
    }

    if (action === "sync") {
      const conn = await loadConnection();
      if (!conn || (!conn.connection_key_enc && !conn.last_synced_at)) {
        return json({ error: "Google Calendar isn't connected yet.", code: "disconnected" }, 400);
      }
      const connectionKey = await loadKey(conn);
      if (!connectionKey) {
        return json({
          error: "Your Google connection expired. Please reconnect Google Calendar.",
          code: "reconnect_required",
        }, 400);
      }
      const timeZone = String(body.timeZone || "UTC");
      const today = String(body.today || toISO(new Date()));
      const horizon = addDays(today, 60);
      const calendarId = conn.calendar_id || "primary";

      const [eventsRes, commitmentsRes, objectivesRes] = await Promise.all([
        admin.from("events").select("*").eq("user_id", user.id),
        admin.from("commitments").select("*").eq("user_id", user.id),
        admin.from("daily_objectives").select("*").eq("user_id", user.id).not("deadline", "is", null),
      ]);

      type Item = { type: string; id: string; fingerprint: string; payload: Record<string, unknown> };
      const items: Item[] = [];

      for (const e of eventsRes.data ?? []) {
        const rec: number[] | null = e.recurring_days ?? null;
        let when: Record<string, unknown>;
        let recurrence: string[] | undefined;
        if (rec && rec.length) {
          const date = nextOccurrence(today, rec);
          when = e.start_time ? timedEvent(date, e.start_time, e.end_time, timeZone) : allDay(date);
          recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${rec.map((d) => DAY_CODES[d]).join(",")}`];
        } else {
          if (!e.event_date || e.event_date < today || e.event_date > horizon) continue;
          when = e.start_time ? timedEvent(e.event_date, e.start_time, e.end_time, timeZone) : allDay(e.event_date);
        }
        const payload = {
          summary: e.title,
          description: [e.description, "Synced from Focused Crew"].filter(Boolean).join("\n\n"),
          ...when,
          ...(recurrence ? { recurrence } : {}),
        };
        items.push({ type: "event", id: e.id, fingerprint: JSON.stringify(payload), payload });
      }

      for (const c of commitmentsRes.data ?? []) {
        const rec: number[] | null = c.recurring_days ?? null;
        let when: Record<string, unknown>;
        let recurrence: string[] | undefined;
        if (rec && rec.length) {
          const date = nextOccurrence(today, rec);
          when = timedEvent(date, c.start_time, c.end_time, timeZone);
          recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${rec.map((d) => DAY_CODES[d]).join(",")}`];
        } else {
          const date = c.date;
          if (!date || date < today || date > horizon) continue;
          when = timedEvent(date, c.start_time, c.end_time, timeZone);
        }
        const payload = {
          summary: c.title,
          description: `${c.type ?? "commitment"} — synced from Focused Crew`,
          ...when,
          ...(recurrence ? { recurrence } : {}),
        };
        items.push({ type: "commitment", id: c.id, fingerprint: JSON.stringify(payload), payload });
      }

      for (const o of objectivesRes.data ?? []) {
        if (o.is_template) continue;
        if (!o.deadline || o.deadline < today || o.deadline > horizon) continue;
        const payload = {
          summary: `🎯 ${o.task}`,
          description: `Objective deadline — synced from Focused Crew`,
          ...allDay(o.deadline),
        };
        items.push({ type: "objective", id: o.id, fingerprint: JSON.stringify(payload), payload });
      }

      const { data: existing } = await admin
        .from("google_calendar_sync_map")
        .select("*")
        .eq("user_id", user.id);
      const byKey = new Map((existing ?? []).map((r) => [`${r.item_type}:${r.item_id}`, r]));

      let created = 0, updated = 0, skipped = 0, failed = 0;

      for (const item of items) {
        const key = `${item.type}:${item.id}`;
        const prev = byKey.get(key);
        byKey.delete(key);
        if (prev && prev.fingerprint === item.fingerprint) { skipped++; continue; }

        let res: Response;
        if (prev) {
          res = await gatewayCall(
            connectionKey,
            `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(prev.google_event_id)}`,
            { method: "PUT", body: JSON.stringify(item.payload) },
          );
          if (res.status === 404 || res.status === 410) {
            res = await gatewayCall(connectionKey, `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
              method: "POST",
              body: JSON.stringify(item.payload),
            });
          }
        } else {
          res = await gatewayCall(connectionKey, `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
            method: "POST",
            body: JSON.stringify(item.payload),
          });
        }

        if (!res.ok) {
          const errText = await res.text();
          console.error(`google event sync failed [${res.status}]: ${errText}`);
          if (res.status === 401 || res.status === 403) {
            return json({ error: "Your Google access expired. Please reconnect Google Calendar.", code: "reconnect_required" }, 400);
          }
          failed++;
          continue;
        }
        const ev = await res.json();
        await admin.from("google_calendar_sync_map").upsert({
          user_id: user.id,
          item_type: item.type,
          item_id: item.id,
          google_event_id: ev.id,
          fingerprint: item.fingerprint,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,item_type,item_id" });
        prev ? updated++ : created++;
      }

      // remove events for items that no longer exist in the app
      let removed = 0;
      for (const stale of byKey.values()) {
        const res = await gatewayCall(
          connectionKey,
          `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(stale.google_event_id)}`,
          { method: "DELETE" },
        );
        if (res.ok || res.status === 404 || res.status === 410) {
          await admin.from("google_calendar_sync_map").delete().eq("id", stale.id);
          removed++;
        }
      }

      await admin
        .from("google_calendar_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", user.id);

      return json({ created, updated, skipped, removed, failed, total: items.length });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("google-calendar error:", err);
    return json({ error: (err as Error).message ?? "Unexpected error" }, 500);
  }
});
