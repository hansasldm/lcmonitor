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

async function verifyJWT(
  token: string,
  secret: string
): Promise<Record<string, unknown> | null> {
  try {
    const [header, payload, signature] = token.split(".");
    const encoder = new TextEncoder();
    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
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
    return decoded;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, jwtSecret: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyJWT(authHeader.replace("Bearer ", ""), jwtSecret);
}

const VALID_EVENT_TYPES = [
  "LOGIN", "LOGOUT", "ACTIVITY", "IDLE_START", "IDLE_END",
  "MANUAL_CLOCK_IN", "MANUAL_CLOCK_OUT",
];

interface IncomingEvent {
  device_id: string;
  type: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const jwtSecret = Deno.env.get("JWT_SECRET")!;
  const claims = await requireAuth(req, jwtSecret);
  if (!claims) return json({ error: "Unauthorized" }, 401);

  const userId = claims.sub as string;
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  try {
    // POST /agent/events
    if (action === "events" && req.method === "POST") {
      const body = await req.json();
      const events: IncomingEvent[] = Array.isArray(body) ? body : [];

      if (events.length === 0) return json({ error: "Empty events array" }, 400);

      // Validate events
      for (const evt of events) {
        if (!evt.device_id || !evt.type || !evt.timestamp) {
          return json({ error: "Each event requires device_id, type, timestamp" }, 400);
        }
        if (!VALID_EVENT_TYPES.includes(evt.type)) {
          return json({ error: `Invalid event type: ${evt.type}` }, 400);
        }
      }

      // Ensure device exists
      const deviceIds = [...new Set(events.map((e) => e.device_id))];
      for (const deviceId of deviceIds) {
        const { data: existingDevice } = await supabase
          .from("devices")
          .select("id")
          .eq("user_id", userId)
          .eq("device_id", deviceId)
          .maybeSingle();

        if (!existingDevice) {
          await supabase.from("devices").insert({
            user_id: userId,
            device_id: deviceId,
            os_type: "WINDOWS", // default, agent can update via metadata
            last_seen_at: new Date().toISOString(),
          });
        } else {
          await supabase
            .from("devices")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", existingDevice.id);
        }
      }

      // Get device UUID mappings
      const { data: deviceRows } = await supabase
        .from("devices")
        .select("id, device_id")
        .eq("user_id", userId)
        .in("device_id", deviceIds);
      const deviceMap: Record<string, string> = {};
      (deviceRows || []).forEach((d) => { deviceMap[d.device_id] = d.id; });

      // Insert events
      const eventRows = events.map((e) => ({
        user_id: userId,
        device_id: deviceMap[e.device_id] || null,
        type: e.type,
        timestamp: e.timestamp,
        metadata: e.metadata || null,
        processed: false,
      }));

      const { error: insertErr } = await supabase.from("events").insert(eventRows);
      if (insertErr) throw insertErr;

      // Process session builder for each affected date
      const dates = [...new Set(events.map((e) => e.timestamp.slice(0, 10)))];
      for (const date of dates) {
        await buildSession(supabase, userId, date, events.filter((e) => e.timestamp.startsWith(date)));
      }

      // Mark events as processed
      const insertedTimestamps = events.map((e) => e.timestamp);
      await supabase
        .from("events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("processed", false)
        .in("timestamp", insertedTimestamps);

      return json({ success: true, events_processed: events.length });
    }

    // POST /agent/test-activity — simulate a full session
    if (action === "test-activity" && req.method === "POST") {
      const now = Date.now();
      const deviceId = "test-device-001";

      const simulatedEvents: IncomingEvent[] = [
        { device_id: deviceId, type: "LOGIN", timestamp: new Date(now - 3600_000).toISOString(), metadata: { source: "test" } },
        { device_id: deviceId, type: "ACTIVITY", timestamp: new Date(now - 3000_000).toISOString(), metadata: { source: "test" } },
        { device_id: deviceId, type: "IDLE_START", timestamp: new Date(now - 2400_000).toISOString(), metadata: { source: "test" } },
        { device_id: deviceId, type: "IDLE_END", timestamp: new Date(now - 1800_000).toISOString(), metadata: { source: "test" } },
        { device_id: deviceId, type: "ACTIVITY", timestamp: new Date(now - 1200_000).toISOString(), metadata: { source: "test" } },
        { device_id: deviceId, type: "LOGOUT", timestamp: new Date(now - 60_000).toISOString(), metadata: { source: "test" } },
      ];

      // Forward to events handler internally
      // Ensure device
      const { data: existingDevice } = await supabase
        .from("devices")
        .select("id")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();

      let dbDeviceId: string;
      if (!existingDevice) {
        const { data: newDevice } = await supabase
          .from("devices")
          .insert({ user_id: userId, device_id: deviceId, os_type: "WINDOWS", last_seen_at: new Date().toISOString() })
          .select("id")
          .single();
        dbDeviceId = newDevice!.id;
      } else {
        dbDeviceId = existingDevice.id;
        await supabase.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", dbDeviceId);
      }

      // Insert events
      const eventRows = simulatedEvents.map((e) => ({
        user_id: userId,
        device_id: dbDeviceId,
        type: e.type,
        timestamp: e.timestamp,
        metadata: e.metadata || null,
        processed: false,
      }));
      const { error: insertErr } = await supabase.from("events").insert(eventRows);
      if (insertErr) throw insertErr;

      // Build session
      const date = simulatedEvents[0].timestamp.slice(0, 10);
      await buildSession(supabase, userId, date, simulatedEvents);

      // Mark processed
      await supabase
        .from("events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("processed", false);

      // Get resulting session
      const { data: session } = await supabase
        .from("work_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();

      return json({
        success: true,
        message: "Test activity simulated: LOGIN → ACTIVITY → IDLE → ACTIVITY → LOGOUT",
        events_count: simulatedEvents.length,
        session,
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Agent error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

/**
 * Session Builder: Creates or updates a work_session for user+date based on events.
 * Merges with existing manual sessions by setting source = MIXED.
 */
async function buildSession(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  date: string,
  newEvents: IncomingEvent[]
) {
  // Sort events by timestamp
  const sorted = [...newEvents].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (sorted.length === 0) return;

  // Get existing session for this date
  const { data: existing } = await supabase
    .from("work_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  const firstEvent = sorted[0];
  const lastEvent = sorted[sorted.length - 1];

  const sessionStarters = ["LOGIN", "MANUAL_CLOCK_IN", "ACTIVITY"];
  const sessionClosers = ["LOGOUT", "MANUAL_CLOCK_OUT"];

  // Calculate idle seconds from IDLE_START/IDLE_END pairs in this batch
  let batchIdleSeconds = 0;
  let idleStartTime: number | null = null;
  for (const evt of sorted) {
    if (evt.type === "IDLE_START") {
      idleStartTime = new Date(evt.timestamp).getTime();
    } else if (evt.type === "IDLE_END" && idleStartTime !== null) {
      batchIdleSeconds += Math.floor((new Date(evt.timestamp).getTime() - idleStartTime) / 1000);
      idleStartTime = null;
    }
  }

  const isClosing = sessionClosers.includes(lastEvent.type);
  const isStarting = sessionStarters.includes(firstEvent.type);

  if (existing) {
    // Merge into existing session
    const updates: Record<string, unknown> = {};

    // Determine new source
    if (existing.source === "MANUAL") {
      updates.source = "MIXED";
    } else if (existing.source === "AUTO") {
      // keep AUTO
    } else {
      updates.source = "MIXED";
    }

    // Extend start_time if new events are earlier
    const existingStart = new Date(existing.start_time).getTime();
    const newStart = new Date(firstEvent.timestamp).getTime();
    if (isStarting && newStart < existingStart) {
      updates.start_time = firstEvent.timestamp;
    }

    // Close session if logout
    if (isClosing && !existing.end_time) {
      updates.end_time = lastEvent.timestamp;

      // Recalculate total active seconds
      const startTime = updates.start_time
        ? new Date(updates.start_time as string).getTime()
        : existingStart;
      const endTime = new Date(lastEvent.timestamp).getTime();
      const totalSeconds = Math.floor((endTime - startTime) / 1000);
      const totalIdle = existing.total_idle_seconds + batchIdleSeconds;
      updates.total_active_seconds = Math.max(0, totalSeconds - totalIdle);
      updates.total_idle_seconds = totalIdle;
    } else {
      // Just accumulate idle
      if (batchIdleSeconds > 0) {
        updates.total_idle_seconds = existing.total_idle_seconds + batchIdleSeconds;
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("work_sessions").update(updates).eq("id", existing.id);
    }
  } else if (isStarting) {
    // Create new AUTO session
    const endTime = isClosing ? lastEvent.timestamp : null;
    let totalActiveSeconds = 0;

    if (endTime) {
      const totalSeconds = Math.floor(
        (new Date(endTime).getTime() - new Date(firstEvent.timestamp).getTime()) / 1000
      );
      totalActiveSeconds = Math.max(0, totalSeconds - batchIdleSeconds);
    }

    await supabase.from("work_sessions").insert({
      user_id: userId,
      date,
      start_time: firstEvent.timestamp,
      end_time: endTime,
      source: "AUTO",
      total_active_seconds: totalActiveSeconds,
      total_idle_seconds: batchIdleSeconds,
    });
  }
}
