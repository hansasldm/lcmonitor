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
  // Path format: /admin/<resource>[/<id>]
  const resource = pathParts[pathParts.length - 2] === "admin" 
    ? pathParts[pathParts.length - 1] 
    : pathParts.length >= 2 ? pathParts[pathParts.length - 2] : pathParts[pathParts.length - 1];
  const resourceId = pathParts[pathParts.length - 2] !== "admin" && pathParts.length >= 2 
    ? pathParts[pathParts.length - 1] 
    : null;

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
      if (req.method === "GET" && !resourceId) {
        const { data, error } = await supabase
          .from("teams")
          .select("id, name, manager_id, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ teams: data });
      }

      if (req.method === "POST") {
        const { name, manager_id } = await req.json();
        if (!name) return json({ error: "name is required" }, 400);
        const { data, error } = await supabase
          .from("teams")
          .insert({ name: name.trim(), manager_id: manager_id || null })
          .select("id, name, manager_id, created_at")
          .single();
        if (error) throw error;
        return json({ team: data }, 201);
      }

      if (req.method === "PUT" && resourceId) {
        const body = await req.json();
        const updates: Record<string, unknown> = {};
        if (body.name !== undefined) updates.name = body.name.trim();
        if (body.manager_id !== undefined) updates.manager_id = body.manager_id || null;

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
