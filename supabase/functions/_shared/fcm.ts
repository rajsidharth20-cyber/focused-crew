// Shared Firebase Cloud Messaging (HTTP v1) sender used by send-push and
// process-reminders. Never logs tokens or message contents.

declare const Deno: { env: { get(name: string): string | undefined } };

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

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

export function loadServiceAccount(): ServiceAccount {
  const sa = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") ?? "{}");
  if (!sa.client_email || !sa.private_key || !sa.project_id) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  }
  return sa;
}

export async function getAccessToken(sa: ServiceAccount) {
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
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${b64url(sig)}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token error [${res.status}]`);
  cachedToken = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return cachedToken.token;
}

/** Only same-origin app paths may be opened from a notification. */
export function safeAppPath(url: unknown): string {
  const s = typeof url === "string" ? url : "";
  return /^\/(?!\/)[A-Za-z0-9\-._~/?#=&%]*$/.test(s) && s.length <= 200 ? s : "/";
}

export type PushMessage = {
  title: string;
  body: string;
  url: string;
  category: string;
  tag: string;
  ttlSeconds?: number;
};

export type SendOutcome = "ok" | "invalid_token" | "transient" | "fatal";

export function classifyFcmError(status: number, body: string): SendOutcome {
  if (/UNREGISTERED|registration-token-not-registered|SENDER_ID_MISMATCH/i.test(body)) return "invalid_token";
  if (status === 404) return "invalid_token";
  if (status === 400 && /INVALID_ARGUMENT/i.test(body) && /token/i.test(body)) return "invalid_token";
  if (status === 429 || status >= 500) return "transient";
  if (status === 401) return "transient"; // access token expired mid-run
  return "fatal";
}

/**
 * Data-only message: the FCM service worker's onBackgroundMessage shows exactly
 * one notification when the app is closed, and the open app shows a toast via
 * onMessage instead. Adding a `notification` block would make the Firebase SDK
 * auto-display a second copy, so it is intentionally omitted.
 */
export function buildFcmMessage(token: string, m: PushMessage) {
  const ttl = Math.max(60, Math.min(86400, Math.round(m.ttlSeconds ?? 86400)));
  return {
    message: {
      token,
      data: {
        title: m.title.slice(0, 120),
        body: m.body.slice(0, 240),
        url: safeAppPath(m.url),
        category: m.category,
        tag: m.tag.slice(0, 120),
      },
      webpush: { headers: { Urgency: "high", TTL: String(ttl) } },
      android: { priority: "high", ttl: `${ttl}s` },
    },
  };
}

/** Sends to one token with one retry on transient errors and a hard timeout. */
export async function sendToToken(sa: ServiceAccount, token: string, m: PushMessage): Promise<{ outcome: SendOutcome; status: number }> {
  let last = { outcome: "transient" as SendOutcome, status: 0 };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const accessToken = await getAccessToken(sa);
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildFcmMessage(token, m)),
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) { await res.body?.cancel(); return { outcome: "ok", status: res.status }; }
      const text = await res.text();
      if (res.status === 401) cachedToken = null;
      last = { outcome: classifyFcmError(res.status, text), status: res.status };
      if (last.outcome !== "transient") return last;
    } catch {
      last = { outcome: "transient", status: 0 };
    }
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
  }
  return last;
}
