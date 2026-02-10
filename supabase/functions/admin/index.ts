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

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function requireAdmin(req: Request, jwtSecret: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const claims = await verifyJWT(authHeader.replace("Bearer ", ""), jwtSecret);
  if (!claims || claims.role !== "ADMIN") return null;
  return claims;
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
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // Improved path parsing: find "admin" and take segments after it
  const adminIdx = pathParts.indexOf("admin");
  const afterAdmin = adminIdx >= 0 ? pathParts.slice(adminIdx + 1) : pathParts;
  const resource = afterAdmin[0] || "";
  const resourceId = afterAdmin[1] || null;
  const subResource = afterAdmin[2] || null;

  try {
    const claims = await requireAdmin(req, jwtSecret);
    if (!claims) return json({ error: "Forbidden" }, 403);

    // ── Stats ──
    if (resource === "stats" && req.method === "GET") {
      const [usersRes, teamsRes, correctionsRes] = await Promise.all([
        supabase.from("users").select("id, status", { count: "exact" }),
        supabase.from("teams").select("id", { count: "exact" }),
        supabase.from("attendance_corrections").select("id", { count: "exact" }).eq("status", "PENDING"),
      ]);
      const totalUsers = usersRes.count ?? 0;
      const activeUsers = usersRes.data?.filter((u) => u.status === "ACTIVE").length ?? 0;
      const totalTeams = teamsRes.count ?? 0;
      const pendingCorrections = correctionsRes.count ?? 0;
      return json({ totalUsers, activeUsers, totalTeams, pendingCorrections });
    }

    // ── Users ──
    if (resource === "users") {
      if (req.method === "GET" && !resourceId) {
        const { data, error } = await supabase
          .from("users")
          .select("id, email, first_name, last_name, role, status, team_id, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ users: data });
      }

      if (req.method === "POST") {
        const { email, password, first_name, last_name, role, team_id, status } = await req.json();
        if (!email || !password || !first_name || !last_name) {
          return json({ error: "email, password, first_name, last_name are required" }, 400);
        }
        const password_hash = await hashPassword(password);
        const { data, error } = await supabase
          .from("users")
          .insert({
            email: email.toLowerCase().trim(),
            password_hash,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            role: role || "EMPLOYEE",
            team_id: team_id || null,
            status: status || "ACTIVE",
          })
          .select("id, email, first_name, last_name, role, status, team_id, created_at")
          .single();
        if (error) {
          if (error.code === "23505") return json({ error: "Email already exists" }, 409);
          throw error;
        }
        return json({ user: data }, 201);
      }

      if (req.method === "PUT" && resourceId) {
        const body = await req.json();
        const updates: Record<string, unknown> = {};
        if (body.first_name !== undefined) updates.first_name = body.first_name.trim();
        if (body.last_name !== undefined) updates.last_name = body.last_name.trim();
        if (body.email !== undefined) updates.email = body.email.toLowerCase().trim();
        if (body.role !== undefined) updates.role = body.role;
        if (body.status !== undefined) updates.status = body.status;
        if (body.team_id !== undefined) updates.team_id = body.team_id || null;
        if (body.password) updates.password_hash = await hashPassword(body.password);

        const { data, error } = await supabase
          .from("users")
          .update(updates)
          .eq("id", resourceId)
          .select("id, email, first_name, last_name, role, status, team_id, created_at")
          .single();
        if (error) throw error;
        return json({ user: data });
      }
    }

    // ── Teams ──
    if (resource === "teams") {
      // GET /teams — list all teams with member counts
      if (req.method === "GET" && !resourceId) {
        const { data: teams, error } = await supabase
          .from("teams")
          .select("id, name, manager_id, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;

        // Fetch member counts and manager names
        const teamIds = (teams || []).map((t) => t.id);
        const managerIds = (teams || []).map((t) => t.manager_id).filter(Boolean);

        const [membersRes, managersRes] = await Promise.all([
          teamIds.length > 0
            ? supabase.from("users").select("team_id").in("team_id", teamIds)
            : Promise.resolve({ data: [] }),
          managerIds.length > 0
            ? supabase.from("users").select("id, first_name, last_name").in("id", managerIds)
            : Promise.resolve({ data: [] }),
        ]);

        const memberCounts: Record<string, number> = {};
        (membersRes.data || []).forEach((u: { team_id: string }) => {
          memberCounts[u.team_id] = (memberCounts[u.team_id] || 0) + 1;
        });

        const managerMap: Record<string, { first_name: string; last_name: string }> = {};
        (managersRes.data || []).forEach((u: { id: string; first_name: string; last_name: string }) => {
          managerMap[u.id] = u;
        });

        const enrichedTeams = (teams || []).map((t) => ({
          ...t,
          member_count: memberCounts[t.id] || 0,
          manager: t.manager_id && managerMap[t.manager_id]
            ? managerMap[t.manager_id]
            : null,
        }));

        return json({ teams: enrichedTeams });
      }

      // GET /teams/:id/members — list members of a team
      if (req.method === "GET" && resourceId && subResource === "members") {
        const { data, error } = await supabase
          .from("users")
          .select("id, email, first_name, last_name, role, status")
          .eq("team_id", resourceId)
          .order("first_name");
        if (error) throw error;
        return json({ members: data });
      }

      // POST /teams/:id/members — assign user(s) to team
      if (req.method === "POST" && resourceId && subResource === "members") {
        const { user_ids } = await req.json();
        if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
          return json({ error: "user_ids array is required" }, 400);
        }

        const { error } = await supabase
          .from("users")
          .update({ team_id: resourceId })
          .in("id", user_ids);
        if (error) throw error;

        return json({ success: true, assigned: user_ids.length });
      }

      // DELETE /teams/:id/members — remove user from team
      if (req.method === "DELETE" && resourceId && subResource === "members") {
        const { user_id } = await req.json();
        if (!user_id) return json({ error: "user_id is required" }, 400);

        const { error } = await supabase
          .from("users")
          .update({ team_id: null })
          .eq("id", user_id);
        if (error) throw error;

        return json({ success: true });
      }

      // POST /teams — create team
      if (req.method === "POST" && !resourceId) {
        const { name, manager_id } = await req.json();
        if (!name) return json({ error: "name is required" }, 400);

        const { data, error } = await supabase
          .from("teams")
          .insert({ name: name.trim(), manager_id: manager_id || null })
          .select("id, name, manager_id, created_at")
          .single();
        if (error) throw error;

        // If manager assigned, update their team_id too
        if (manager_id) {
          await supabase.from("users").update({ team_id: data.id }).eq("id", manager_id);
        }

        return json({ team: data }, 201);
      }

      // PUT /teams/:id — update team
      if (req.method === "PUT" && resourceId && !subResource) {
        const body = await req.json();
        const updates: Record<string, unknown> = {};
        if (body.name !== undefined) updates.name = body.name.trim();
        if (body.manager_id !== undefined) updates.manager_id = body.manager_id || null;

        // Get old manager to clear their team_id if manager changed
        if (body.manager_id !== undefined) {
          const { data: oldTeam } = await supabase
            .from("teams")
            .select("manager_id")
            .eq("id", resourceId)
            .single();

          if (oldTeam?.manager_id && oldTeam.manager_id !== body.manager_id) {
            // Clear old manager's team_id
            await supabase.from("users").update({ team_id: null }).eq("id", oldTeam.manager_id);
          }

          // Set new manager's team_id
          if (body.manager_id) {
            await supabase.from("users").update({ team_id: resourceId }).eq("id", body.manager_id);
          }
        }

        const { data, error } = await supabase
          .from("teams")
          .update(updates)
          .eq("id", resourceId)
          .select("id, name, manager_id, created_at")
          .single();
        if (error) throw error;
        return json({ team: data });
      }
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Admin error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
