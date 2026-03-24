import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS (restricted origins) ──
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed =
    origin.endsWith(".lovable.app") || origin.endsWith(".lovableproject.com") || origin.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// ── Validation ──
const VALID_EVENT_TYPES = [
  "LOGIN", "LOGOUT", "ACTIVITY", "IDLE_START", "IDLE_END",
  "MANUAL_CLOCK_IN", "MANUAL_CLOCK_OUT",
];
const VALID_OS_TYPES = ["WINDOWS", "MACOS", "LINUX"];

function validateDeviceId(v: unknown): string {
  if (typeof v !== "string" || v.length === 0 || v.length > 200) return "web-test-device";
  return v;
}
function validateOsType(v: unknown): string {
  if (typeof v === "string" && VALID_OS_TYPES.includes(v)) return v;
  return "WINDOWS";
}
function isValidTimestamp(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}
function isValidMetadata(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v !== "object" || Array.isArray(v)) return false;
  const str = JSON.stringify(v);
  return str.length <= 10000; // 10KB max
}

const WEB_DEVICE_ID = "web-test-device";

async function getUser(_supabase: ReturnType<typeof createClient>, req: Request) {
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

async function ensureDevice(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  deviceId: string = WEB_DEVICE_ID,
  osType: string = "WINDOWS"
): Promise<string> {
  const validOs = VALID_OS_TYPES.includes(osType) ? osType : "WINDOWS";
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existing) {
    await supabase.from("devices").update({ last_seen_at: now }).eq("id", existing.id);
    return existing.id;
  }

  const { data: newDevice } = await supabase
    .from("devices")
    .insert({ user_id: userId, device_id: deviceId, os_type: validOs, last_seen_at: now })
    .select("id")
    .single();
  return newDevice!.id;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
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
    // POST /agent/events
    if (action === "events" && req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: "Invalid JSON body" }, 400);

      const events: Array<{ type: string; timestamp: string; metadata?: unknown; device_id?: string; os_type?: string }> =
        Array.isArray(body) ? body : [body];

      if (events.length === 0) return json({ error: "At least one event is required" }, 400);
      if (events.length > 500) return json({ error: "Maximum 500 events per request" }, 400);

      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (!ev.type || !VALID_EVENT_TYPES.includes(ev.type)) {
          return json({ error: `Event[${i}]: invalid or missing type` }, 400);
        }
        if (!isValidTimestamp(ev.timestamp)) {
          return json({ error: `Event[${i}]: invalid or missing timestamp` }, 400);
        }
        if (!isValidMetadata(ev.metadata)) {
          return json({ error: `Event[${i}]: metadata must be an object under 10KB` }, 400);
        }
      }

      const deviceIds = [...new Set(events.map((e) => validateDeviceId(e.device_id) || WEB_DEVICE_ID))];
      const deviceMap: Record<string, string> = {};
      for (const did of deviceIds) {
        const osHint = events.find((e) => (validateDeviceId(e.device_id) || WEB_DEVICE_ID) === did)?.os_type;
        deviceMap[did] = await ensureDevice(supabase, userId, did, validateOsType(osHint));
      }

      const rows = events.map((ev) => ({
        user_id: userId,
        device_id: deviceMap[validateDeviceId(ev.device_id) || WEB_DEVICE_ID],
        type: ev.type,
        timestamp: ev.timestamp,
        metadata: ev.metadata || null,
        processed: false,
      }));

      const { error } = await supabase.from("events").insert(rows);
      if (error) throw error;

      return json({ success: true, insertedCount: rows.length });
    }

    // POST /agent/test-activity
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

    // POST /agent/debug/make-admin (disabled)
    if (action === "make-admin" && req.method === "POST") {
      return json({ error: "This debug endpoint is disabled" }, 403);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Agent error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
