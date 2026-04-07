import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function isUUID(v: unknown): boolean {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
const VALID_PERIODS = ["today", "week"];
function validatePeriod(v: unknown): string {
  if (typeof v === "string" && VALID_PERIODS.includes(v)) return v;
  return "today";
}

async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, payload, signature] = token.split(".");
    const encoder = new TextEncoder();
    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
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

function weekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
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

  const jwtSecret = Deno.env.get("JWT_SECRET")!;
  const claims = await requireAuth(req, jwtSecret);
  if (!claims) return json({ error: "Unauthorized" }, 401);

  const userId = claims.sub as string;
  const userRole = claims.role as string;
  const userTeamId = claims.team_id as string | null;
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  try {
    // GET /work-sessions/status
    if (action === "status" && req.method === "GET") {
      // Fetch ALL sessions for today (multiple clock-in/out cycles)
      const { data: sessions, error } = await supabase
        .from("work_sessions")
        .select("id, start_time, end_time, total_active_seconds, date")
        .eq("user_id", userId)
        .eq("date", todayDate())
        .order("start_time", { ascending: true });
      if (error) throw error;

      const allSessions = sessions || [];
      // Active session = the one with no end_time
      const activeSession = allSessions.find((s) => !s.end_time) || null;
      // For backward compat, "session" = active session or last completed
      const currentSession = activeSession || allSessions[allSessions.length - 1] || null;

      // Get today's breaks
      const { data: breaks } = await supabase
        .from("breaks")
        .select("id, break_start, break_end, duration_seconds, session_id")
        .eq("user_id", userId)
        .eq("date", todayDate())
        .order("break_start", { ascending: true });

      const activeBreak = (breaks || []).find((b: { break_end: string | null }) => !b.break_end) || null;
      const totalBreakSeconds = (breaks || []).reduce((sum: number, b: { duration_seconds: number; break_start: string; break_end: string | null }) => {
        if (b.break_end) return sum + b.duration_seconds;
        return sum + Math.floor((Date.now() - new Date(b.break_start).getTime()) / 1000);
      }, 0);

      // Total active seconds across ALL completed sessions
      const totalCompletedSeconds = allSessions
        .filter((s) => s.end_time)
        .reduce((sum, s) => sum + s.total_active_seconds, 0);

      return json({
        session: currentSession,
        sessions: allSessions,
        is_working: !!activeSession,
        on_break: !!activeBreak,
        active_break: activeBreak,
        breaks: breaks || [],
        total_break_seconds: totalBreakSeconds,
        total_completed_seconds: totalCompletedSeconds,
        session_count: allSessions.length,
      });
    }

    // POST /work-sessions/clock-in
    if (action === "clock-in" && req.method === "POST") {
      const now = new Date();
      const today = todayDate();

      // Close ALL existing open sessions for this user (enforce single active session)
      const { data: openSessions } = await supabase
        .from("work_sessions")
        .select("id, start_time")
        .eq("user_id", userId)
        .is("end_time", null);

      if (openSessions && openSessions.length > 0) {
        for (const os of openSessions) {
          // Close any active breaks on this session
          const { data: activeBreaks } = await supabase
            .from("breaks")
            .select("id, break_start")
            .eq("session_id", os.id)
            .eq("user_id", userId)
            .is("break_end", null);

          if (activeBreaks && activeBreaks.length > 0) {
            for (const ab of activeBreaks) {
              const brkDur = Math.floor((now.getTime() - new Date(ab.break_start).getTime()) / 1000);
              await supabase
                .from("breaks")
                .update({ break_end: now.toISOString(), duration_seconds: Math.max(0, brkDur) })
                .eq("id", ab.id);
            }
          }

          // Calculate total break time for the session
          const { data: allBreaks } = await supabase
            .from("breaks")
            .select("duration_seconds")
            .eq("session_id", os.id);
          const totalBreakSec = (allBreaks || []).reduce((s: number, b: { duration_seconds: number }) => s + b.duration_seconds, 0);

          const totalSec = Math.floor((now.getTime() - new Date(os.start_time).getTime()) / 1000);
          const activeSec = Math.max(0, totalSec - totalBreakSec);

          await supabase
            .from("work_sessions")
            .update({ end_time: now.toISOString(), total_active_seconds: activeSec })
            .eq("id", os.id);
        }
      }

      // Create new session
      const { data: session, error } = await supabase
        .from("work_sessions")
        .insert({ user_id: userId, date: today, start_time: now.toISOString(), source: "MANUAL" })
        .select("id, start_time, end_time, total_active_seconds, date")
        .single();
      if (error) throw error;
      return json({ session, is_working: true }, 201);
    }

    // POST /work-sessions/clock-out
    if (action === "clock-out" && req.method === "POST") {
      const now = new Date();

      // Find ALL active sessions for this user (end_time IS NULL)
      const { data: openSessions, error: fetchErr } = await supabase
        .from("work_sessions")
        .select("id, start_time")
        .eq("user_id", userId)
        .is("end_time", null);
      if (fetchErr) throw fetchErr;
      if (!openSessions || openSessions.length === 0) {
        return json({ error: "No active session to clock out" }, 400);
      }

      const closedSessions = [];

      for (const session of openSessions) {
        // Close any active breaks on this session
        const { data: activeBreaks } = await supabase
          .from("breaks")
          .select("id, break_start")
          .eq("session_id", session.id)
          .eq("user_id", userId)
          .is("break_end", null);

        if (activeBreaks && activeBreaks.length > 0) {
          for (const ab of activeBreaks) {
            const brkDur = Math.floor((now.getTime() - new Date(ab.break_start).getTime()) / 1000);
            await supabase
              .from("breaks")
              .update({ break_end: now.toISOString(), duration_seconds: Math.max(0, brkDur) })
              .eq("id", ab.id);
          }
        }

        // Calculate total break time
        const { data: allBreaks } = await supabase
          .from("breaks")
          .select("duration_seconds")
          .eq("session_id", session.id);
        const totalBreakSec = (allBreaks || []).reduce((s: number, b: { duration_seconds: number }) => s + b.duration_seconds, 0);

        const totalSec = Math.floor((now.getTime() - new Date(session.start_time).getTime()) / 1000);
        const activeSec = Math.max(0, totalSec - totalBreakSec);

        const { data: updated, error: updateErr } = await supabase
          .from("work_sessions")
          .update({ end_time: now.toISOString(), total_active_seconds: activeSec })
          .eq("id", session.id)
          .select("id, start_time, end_time, total_active_seconds, date")
          .single();
        if (updateErr) throw updateErr;
        closedSessions.push(updated);
      }

      return json({ session: closedSessions[0], sessions_closed: closedSessions.length, is_working: false });
    }

    // POST /work-sessions/break-in (start a break)
    if (action === "break-in" && req.method === "POST") {
      const today = todayDate();
      const { data: session } = await supabase
        .from("work_sessions")
        .select("id, end_time")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (!session || session.end_time) return json({ error: "No active session. Clock in first." }, 400);

      // Check if already on break
      const { data: existingBreak } = await supabase
        .from("breaks")
        .select("id")
        .eq("session_id", session.id)
        .eq("user_id", userId)
        .is("break_end", null)
        .maybeSingle();

      if (existingBreak) return json({ error: "Already on break" }, 409);

      const now = new Date().toISOString();
      const { data: newBreak, error } = await supabase
        .from("breaks")
        .insert({ session_id: session.id, user_id: userId, date: today, break_start: now })
        .select("id, break_start, break_end, duration_seconds")
        .single();
      if (error) throw error;

      return json({ break: newBreak, on_break: true }, 201);
    }

    // POST /work-sessions/break-out (end a break)
    if (action === "break-out" && req.method === "POST") {
      const today = todayDate();
      const { data: session } = await supabase
        .from("work_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (!session) return json({ error: "No active session" }, 400);

      const { data: activeBreak } = await supabase
        .from("breaks")
        .select("id, break_start")
        .eq("session_id", session.id)
        .eq("user_id", userId)
        .is("break_end", null)
        .maybeSingle();

      if (!activeBreak) return json({ error: "Not on break" }, 400);

      const now = new Date();
      const durationSeconds = Math.floor((now.getTime() - new Date(activeBreak.break_start).getTime()) / 1000);

      const { data: updated, error } = await supabase
        .from("breaks")
        .update({ break_end: now.toISOString(), duration_seconds: durationSeconds })
        .eq("id", activeBreak.id)
        .select("id, break_start, break_end, duration_seconds")
        .single();
      if (error) throw error;

      return json({ break: updated, on_break: false });
    }

    // GET /work-sessions/active-now
    if (action === "active-now" && req.method === "GET") {
      const { data, error } = await supabase
        .from("work_sessions")
        .select("id, user_id, start_time, date")
        .eq("date", todayDate())
        .is("end_time", null);
      if (error) throw error;

      const userIds = (data || []).map((s) => s.user_id);
      let users: Record<string, { first_name: string; last_name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, first_name, last_name, email")
          .in("id", userIds);
        if (usersData) users = Object.fromEntries(usersData.map((u) => [u.id, u]));
      }

      // Check who's on break
      const sessionIds = (data || []).map((s) => s.id);
      let breakMap: Record<string, boolean> = {};
      if (sessionIds.length > 0) {
        const { data: activeBreaks } = await supabase
          .from("breaks")
          .select("session_id")
          .in("session_id", sessionIds)
          .is("break_end", null);
        (activeBreaks || []).forEach((b: { session_id: string }) => { breakMap[b.session_id] = true; });
      }

      const activeSessions = (data || []).map((s) => ({
        ...s,
        user: users[s.user_id] || null,
        on_break: !!breakMap[s.id],
      }));
      return json({ active_sessions: activeSessions });
    }

    // GET /work-sessions/team-overview
    if (action === "team-overview" && req.method === "GET") {
      if (userRole !== "MANAGER" && userRole !== "ADMIN") {
        return json({ error: "Forbidden" }, 403);
      }

      const period = validatePeriod(url.searchParams.get("period"));
      const dateFrom = period === "week" ? weekStart() : todayDate();
      const dateTo = todayDate();

      let teamId = userTeamId;
      if (userRole === "ADMIN" && url.searchParams.get("team_id")) {
        const tid = url.searchParams.get("team_id");
        if (tid && isUUID(tid)) teamId = tid;
      }

      if (!teamId) {
        return json({ hasTeam: false, members: [], message: "No team assigned. Ask admin to assign you to a team." });
      }

      const { data: members, error: membersErr } = await supabase
        .from("users")
        .select("id, email, first_name, last_name, role, status")
        .eq("team_id", teamId)
        .eq("status", "ACTIVE")
        .order("first_name");
      if (membersErr) throw membersErr;

      if (!members || members.length === 0) {
        return json({ members: [], team_id: teamId });
      }

      const memberIds = members.map((m) => m.id);

      const { data: sessions, error: sessionsErr } = await supabase
        .from("work_sessions")
        .select("id, user_id, date, start_time, end_time, total_active_seconds")
        .in("user_id", memberIds)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });
      if (sessionsErr) throw sessionsErr;

      const sessionsByUser: Record<string, Array<{
        id: string; date: string; start_time: string;
        end_time: string | null; total_active_seconds: number;
      }>> = {};
      (sessions || []).forEach((s) => {
        if (!sessionsByUser[s.user_id]) sessionsByUser[s.user_id] = [];
        sessionsByUser[s.user_id].push(s);
      });

      const now = Date.now();
      const enrichedMembers = members.map((m) => {
        const userSessions = sessionsByUser[m.id] || [];
        const todaySessions = userSessions.filter((s) => s.date === todayDate());
        const todaySession = todaySessions[0] || null;

        const isWorking = todaySession ? !todaySession.end_time : false;

        let todaySeconds = 0;
        if (todaySession) {
          if (todaySession.end_time) {
            todaySeconds = todaySession.total_active_seconds;
          } else {
            todaySeconds = Math.floor((now - new Date(todaySession.start_time).getTime()) / 1000);
          }
        }

        let periodSeconds = 0;
        userSessions.forEach((s) => {
          if (s.end_time) {
            periodSeconds += s.total_active_seconds;
          } else {
            periodSeconds += Math.floor((now - new Date(s.start_time).getTime()) / 1000);
          }
        });

        return {
          ...m,
          is_working: isWorking,
          today_seconds: todaySeconds,
          period_seconds: periodSeconds,
          today_session: todaySession,
          session_count: userSessions.length,
        };
      });

      return json({ members: enrichedMembers, team_id: teamId, period });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Work sessions error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});