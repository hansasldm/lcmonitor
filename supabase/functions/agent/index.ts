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

async function ensureDevice(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  deviceId: string = WEB_DEVICE_ID,
  osType: string = "WINDOWS"
): Promise<string> {
  const validOs = ["WINDOWS", "MACOS", "LINUX"].includes(osType) ? osType : "WINDOWS";
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
    // POST /agent/events — accepts single event or array of events
    if (action === "events" && req.method === "POST") {
      const body = await req.json();
      const events: Array<{ type: string; timestamp: string; metadata?: unknown; device_id?: string; os_type?: string }> =
        Array.isArray(body) ? body : [body];

      if (events.length === 0) return json({ error: "At least one event is required" }, 400);
      if (events.length > 500) return json({ error: "Maximum 500 events per request" }, 400);

      // Validate all events first
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (!ev.type || !ev.timestamp) {
          return json({ error: `Event[${i}]: type and timestamp are required` }, 400);
        }
        if (!VALID_EVENT_TYPES.includes(ev.type)) {
          return json({ error: `Event[${i}]: invalid type "${ev.type}"` }, 400);
        }
      }

      // Collect unique device_ids and upsert them
      const deviceIds = [...new Set(events.map((e) => e.device_id || WEB_DEVICE_ID))];
      const deviceMap: Record<string, string> = {};
      for (const did of deviceIds) {
        const osHint = events.find((e) => (e.device_id || WEB_DEVICE_ID) === did)?.os_type;
        deviceMap[did] = await ensureDevice(supabase, userId, did, osHint as string);
      }

      // Build rows
      const rows = events.map((ev) => ({
        user_id: userId,
        device_id: deviceMap[ev.device_id || WEB_DEVICE_ID],
        type: ev.type,
        timestamp: ev.timestamp,
        metadata: ev.metadata || null,
        processed: false,
      }));

      const { error } = await supabase.from("events").insert(rows);
      if (error) throw error;

      return json({ success: true, insertedCount: rows.length });
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

    // POST /agent/heartbeat — heartbeat-based session tracking
    if (action === "heartbeat" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const deviceIdRaw: string = body.device_id || WEB_DEVICE_ID;
      const osType: string = body.os_type || "WINDOWS";
      const now = new Date();
      const nowISO = now.toISOString();
      const todayDate = nowISO.slice(0, 10); // YYYY-MM-DD

      // 1. Upsert device
      const dbDeviceId = await ensureDevice(supabase, userId, deviceIdRaw, osType);

      // 2. Insert heartbeat record
      await supabase.from("heartbeats").insert({
        user_id: userId,
        device_id: dbDeviceId,
        timestamp: nowISO,
        last_seen: nowISO,
      });

      // 3. Close any stale sessions (no heartbeat for 5 min) for this user
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      const { data: staleSessions } = await supabase
        .from("work_sessions")
        .select("id, updated_at")
        .eq("user_id", userId)
        .is("end_time", null)
        .lt("updated_at", fiveMinAgo);

      if (staleSessions && staleSessions.length > 0) {
        for (const s of staleSessions) {
          await supabase
            .from("work_sessions")
            .update({ end_time: s.updated_at, updated_at: nowISO })
            .eq("id", s.id);
        }
      }

      // 4. Check for active session today
      const { data: activeSession } = await supabase
        .from("work_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("date", todayDate)
        .is("end_time", null)
        .maybeSingle();

      if (activeSession) {
        // Update last_seen (via updated_at)
        await supabase
          .from("work_sessions")
          .update({ updated_at: nowISO })
          .eq("id", activeSession.id);
      } else {
        // No active session → create one (auto clock-in)
        await supabase.from("work_sessions").insert({
          user_id: userId,
          date: todayDate,
          start_time: nowISO,
          source: "AUTO",
          total_active_seconds: 0,
          total_idle_seconds: 0,
        });
      }

      return json({ success: true });
    }

    // POST /agent/debug/make-admin — one-time: promote current user to ADMIN
    if (action === "make-admin" && req.method === "POST") {
      const ENABLED = false;
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
