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
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
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

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
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
    // GET /work-sessions/status — get today's session status
    if (action === "status" && req.method === "GET") {
      const { data: session, error } = await supabase
        .from("work_sessions")
        .select("id, start_time, end_time, total_active_seconds, date")
        .eq("user_id", userId)
        .eq("date", todayDate())
        .maybeSingle();

      if (error) throw error;

      return json({
        session: session || null,
        is_working: session ? !session.end_time : false,
      });
    }

    // POST /work-sessions/clock-in
    if (action === "clock-in" && req.method === "POST") {
      const today = todayDate();

      // Check for existing open session today
      const { data: existing } = await supabase
        .from("work_sessions")
        .select("id, end_time")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (existing && !existing.end_time) {
        return json({ error: "Already clocked in" }, 409);
      }

      if (existing && existing.end_time) {
        return json({ error: "Already completed a session today" }, 409);
      }

      const now = new Date().toISOString();
      const { data: session, error } = await supabase
        .from("work_sessions")
        .insert({
          user_id: userId,
          date: today,
          start_time: now,
          source: "MANUAL",
        })
        .select("id, start_time, end_time, total_active_seconds, date")
        .single();

      if (error) {
        if (error.code === "23505") {
          return json({ error: "Session already exists for today" }, 409);
        }
        throw error;
      }

      return json({ session, is_working: true }, 201);
    }

    // POST /work-sessions/clock-out
    if (action === "clock-out" && req.method === "POST") {
      const { data: session, error: fetchErr } = await supabase
        .from("work_sessions")
        .select("id, start_time, end_time")
        .eq("user_id", userId)
        .eq("date", todayDate())
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (!session || session.end_time) {
        return json({ error: "No active session to clock out" }, 400);
      }

      const now = new Date();
      const startTime = new Date(session.start_time);
      const activeSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

      const { data: updated, error: updateErr } = await supabase
        .from("work_sessions")
        .update({
          end_time: now.toISOString(),
          total_active_seconds: activeSeconds,
        })
        .eq("id", session.id)
        .select("id, start_time, end_time, total_active_seconds, date")
        .single();

      if (updateErr) throw updateErr;

      return json({ session: updated, is_working: false });
    }

    // GET /work-sessions/active-now — admin: who is working now
    if (action === "active-now" && req.method === "GET") {
      const { data, error } = await supabase
        .from("work_sessions")
        .select("id, user_id, start_time, date")
        .eq("date", todayDate())
        .is("end_time", null);

      if (error) throw error;

      // Get user details for active sessions
      const userIds = (data || []).map((s) => s.user_id);
      let users: Record<string, { first_name: string; last_name: string; email: string }> = {};

      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, first_name, last_name, email")
          .in("id", userIds);

        if (usersData) {
          users = Object.fromEntries(usersData.map((u) => [u.id, u]));
        }
      }

      const activeSessions = (data || []).map((s) => ({
        ...s,
        user: users[s.user_id] || null,
      }));

      return json({ active_sessions: activeSessions });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Work sessions error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
