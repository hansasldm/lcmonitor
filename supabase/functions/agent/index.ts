import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const VALID_EVENT_TYPES = [
  "LOGIN", "LOGOUT", "ACTIVITY", "IDLE_START", "IDLE_END",
  "MANUAL_CLOCK_IN", "MANUAL_CLOCK_OUT",
];

const WEB_DEVICE_ID = "web-test-device";

async function getUser(supabase: ReturnType<typeof createClient>, req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");

  const jwtSecret = Deno.env.get("JWT_SECRET")!;
  try {
    const [header, payload, signature] = token.split(".");
    const encoder = new TextEncoder();
    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(jwtSecret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sig = signature.replace(/-/g, "+").replace(/_/g, "/");
    const sigPadded = sig + "=".repeat((4 - (sig.length % 4)) % 4);
    const sigBytes = Uint8Array.from(atob(sigPadded), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(data));
    if (!valid) return null;
    const payloadStr = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadStr + "=".repeat((4 - (payloadStr.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded.sub as string;
  } catch {
    return null;
  }
}

async function ensureDevice(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: existing } = await supabase
    .from("devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_id", WEB_DEVICE_ID)
    .maybeSingle();

  if (existing) {
    await supabase.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", existing.id);
    return existing.id;
  }

  const { data: newDevice } = await supabase
    .from("devices")
    .insert({ user_id: userId, device_id: WEB_DEVICE_ID, os_type: "WINDOWS", last_seen_at: new Date().toISOString() })
    .select("id")
    .single();
  return newDevice!.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const userId = await getUser(supabase, req);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  try {
    // POST /agent/events — single event
    if (action === "events" && req.method === "POST") {
      const body = await req.json();
      const { type, timestamp, metadata } = body;

      if (!type || !timestamp) {
        return json({ error: "type and timestamp are required" }, 400);
      }
      if (!VALID_EVENT_TYPES.includes(type)) {
        return json({ error: `Invalid event type: ${type}` }, 400);
      }

      const dbDeviceId = await ensureDevice(supabase, userId);

      const { error } = await supabase.from("events").insert({
        user_id: userId,
        device_id: dbDeviceId,
        type,
        timestamp,
        metadata: metadata || null,
        processed: false,
      });
      if (error) throw error;

      return json({ success: true });
    }

    // POST /agent/test-activity — insert a sample ACTIVITY event
    if (action === "test-activity" && req.method === "POST") {
      const dbDeviceId = await ensureDevice(supabase, userId);
      const now = new Date().toISOString();

      const { error } = await supabase.from("events").insert({
        user_id: userId,
        device_id: dbDeviceId,
        type: "ACTIVITY",
        timestamp: now,
        metadata: { source: "test" },
        processed: false,
      });
      if (error) throw error;

      return json({ success: true, message: "Sample ACTIVITY event inserted", timestamp: now });
    }

    // POST /agent/debug/make-admin — one-time: promote current user to ADMIN
    if (action === "make-admin" && req.method === "POST") {
      const ENABLED = false; // DISABLED — already have admin accounts
      if (!ENABLED) return json({ error: "This debug endpoint is disabled" }, 403);

      const { data, error } = await supabase
        .from("users")
        .update({ role: "ADMIN" })
        .eq("id", userId)
        .select("id, email, role")
        .single();
      if (error) throw error;

      return json({ success: true, message: "You are now ADMIN. Disable this endpoint!", user: data });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Agent error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
