import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Returns only the *publishable* Firebase web config (safe to expose in a browser).
serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const body = {
    apiKey: Deno.env.get("FIREBASE_API_KEY") ?? "",
    projectId: Deno.env.get("FIREBASE_PROJECT_ID") ?? "",
    messagingSenderId: Deno.env.get("FIREBASE_MESSAGING_SENDER_ID") ?? "",
    appId: Deno.env.get("FIREBASE_APP_ID") ?? "",
    vapidKey: Deno.env.get("FIREBASE_VAPID_PUBLIC_KEY") ?? "",
  };

  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
});
