import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS (restricted origins) ──
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed =
    origin.endsWith(".lovable.app") || origin.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// ── Validation helpers ──
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim().toLowerCase();
  if (trimmed.length > 255 || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}
function validateStr(v: unknown, min = 1, max = 100): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
}
function validatePassword(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (v.length < 8 || v.length > 128) return null;
  return v;
}
const VALID_ROLES = ["EMPLOYEE", "MANAGER", "ADMIN"];
function validateRole(v: unknown): string | null {
  if (typeof v !== "string" || !VALID_ROLES.includes(v)) return null;
  return v;
}
const VALID_STATUSES = ["ACTIVE", "INACTIVE"];
function validateStatus(v: unknown): string | null {
  if (typeof v !== "string" || !VALID_STATUSES.includes(v)) return null;
  return v;
}
function isUUID(v: unknown): boolean {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ── PBKDF2 password hashing ──
async function hashPasswordPBKDF2(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, 256
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${saltHex}:${hashHex}`;
}

// ── JWT verify ──
async function verifyJWT(
  token: string,
  secret: string
): Promise<Record<string, unknown> | null> {
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

async function requireAdmin(req: Request, jwtSecret: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const claims = await verifyJWT(authHeader.replace("Bearer ", ""), jwtSecret);
  if (!claims || claims.role !== "ADMIN") return null;
  return claims;
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
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

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
        const body = await req.json().catch(() => ({}));
        const email = validateEmail(body.email);
        const password = validatePassword(body.password);
        const first_name = validateStr(body.first_name);
        const last_name = validateStr(body.last_name);
        const role = body.role ? validateRole(body.role) : "EMPLOYEE";
        const status = body.status ? validateStatus(body.status) : "ACTIVE";
        const team_id = body.team_id && isUUID(body.team_id) ? body.team_id : null;

        if (!email || !password || !first_name || !last_name || !role || !status) {
          return json({ error: "Valid email, password (8-128 chars), first_name, last_name are required. Role must be EMPLOYEE/MANAGER/ADMIN." }, 400);
        }

        const password_hash = await hashPasswordPBKDF2(password);
        const { data, error } = await supabase
          .from("users")
          .insert({ email, password_hash, first_name, last_name, role, team_id, status })
          .select("id, email, first_name, last_name, role, status, team_id, created_at")
          .single();
        if (error) {
          if (error.code === "23505") return json({ error: "Email already exists" }, 409);
          throw error;
        }
        return json({ user: data }, 201);
      }

      if (req.method === "PUT" && resourceId) {
        if (!isUUID(resourceId)) return json({ error: "Invalid user ID" }, 400);
        const body = await req.json().catch(() => ({}));
        const updates: Record<string, unknown> = {};

        if (body.first_name !== undefined) {
          const v = validateStr(body.first_name);
          if (!v) return json({ error: "first_name must be 1-100 chars" }, 400);
          updates.first_name = v;
        }
        if (body.last_name !== undefined) {
          const v = validateStr(body.last_name);
          if (!v) return json({ error: "last_name must be 1-100 chars" }, 400);
          updates.last_name = v;
        }
        if (body.email !== undefined) {
          const v = validateEmail(body.email);
          if (!v) return json({ error: "Invalid email" }, 400);
          updates.email = v;
        }
        if (body.role !== undefined) {
          const v = validateRole(body.role);
          if (!v) return json({ error: "Role must be EMPLOYEE, MANAGER, or ADMIN" }, 400);
          updates.role = v;
        }
        if (body.status !== undefined) {
          const v = validateStatus(body.status);
          if (!v) return json({ error: "Status must be ACTIVE or INACTIVE" }, 400);
          updates.status = v;
        }
        if (body.team_id !== undefined) {
          updates.team_id = body.team_id && isUUID(body.team_id) ? body.team_id : null;
        }
        if (body.password) {
          const v = validatePassword(body.password);
          if (!v) return json({ error: "Password must be 8-128 chars" }, 400);
          updates.password_hash = await hashPasswordPBKDF2(v);
        }

        if (Object.keys(updates).length === 0) return json({ error: "No valid fields to update" }, 400);

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
        const { data: teams, error } = await supabase
          .from("teams")
          .select("id, name, manager_id, created_at")
          .order("created_at", { ascending: false });
        if (error) throw error;

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
          manager: t.manager_id && managerMap[t.manager_id] ? managerMap[t.manager_id] : null,
        }));

        return json({ teams: enrichedTeams });
      }

      if (req.method === "GET" && resourceId && subResource === "members") {
        if (!isUUID(resourceId)) return json({ error: "Invalid team ID" }, 400);
        const { data, error } = await supabase
          .from("users")
          .select("id, email, first_name, last_name, role, status")
          .eq("team_id", resourceId)
          .order("first_name");
        if (error) throw error;
        return json({ members: data });
      }

      if (req.method === "POST" && resourceId && subResource === "members") {
        if (!isUUID(resourceId)) return json({ error: "Invalid team ID" }, 400);
        const body = await req.json().catch(() => ({}));
        const { user_ids } = body;
        if (!Array.isArray(user_ids) || user_ids.length === 0 || user_ids.length > 100 || !user_ids.every(isUUID)) {
          return json({ error: "user_ids must be an array of 1-100 valid UUIDs" }, 400);
        }
        const { error } = await supabase.from("users").update({ team_id: resourceId }).in("id", user_ids);
        if (error) throw error;
        return json({ success: true, assigned: user_ids.length });
      }

      if (req.method === "DELETE" && resourceId && subResource === "members") {
        if (!isUUID(resourceId)) return json({ error: "Invalid team ID" }, 400);
        const body = await req.json().catch(() => ({}));
        if (!body.user_id || !isUUID(body.user_id)) return json({ error: "Valid user_id is required" }, 400);
        const { error } = await supabase.from("users").update({ team_id: null }).eq("id", body.user_id);
        if (error) throw error;
        return json({ success: true });
      }

      if (req.method === "POST" && !resourceId) {
        const body = await req.json().catch(() => ({}));
        const name = validateStr(body.name, 1, 200);
        const manager_id = body.manager_id && isUUID(body.manager_id) ? body.manager_id : null;
        if (!name) return json({ error: "Team name (1-200 chars) is required" }, 400);

        const { data, error } = await supabase
          .from("teams")
          .insert({ name, manager_id })
          .select("id, name, manager_id, created_at")
          .single();
        if (error) throw error;

        if (manager_id) {
          await supabase.from("users").update({ team_id: data.id }).eq("id", manager_id);
        }
        return json({ team: data }, 201);
      }

      if (req.method === "PUT" && resourceId && !subResource) {
        if (!isUUID(resourceId)) return json({ error: "Invalid team ID" }, 400);
        const body = await req.json().catch(() => ({}));
        const updates: Record<string, unknown> = {};
        if (body.name !== undefined) {
          const v = validateStr(body.name, 1, 200);
          if (!v) return json({ error: "Team name must be 1-200 chars" }, 400);
          updates.name = v;
        }
        if (body.manager_id !== undefined) {
          updates.manager_id = body.manager_id && isUUID(body.manager_id) ? body.manager_id : null;
        }

        if (body.manager_id !== undefined) {
          const { data: oldTeam } = await supabase.from("teams").select("manager_id").eq("id", resourceId).single();
          if (oldTeam?.manager_id && oldTeam.manager_id !== body.manager_id) {
            await supabase.from("users").update({ team_id: null }).eq("id", oldTeam.manager_id);
          }
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

    // ── Events ──
    if (resource === "events" && req.method === "GET") {
      const { data: events, error } = await supabase
        .from("events")
        .select("id, timestamp, type, device_id, metadata, user_id, processed")
        .order("timestamp", { ascending: false })
        .limit(100);
      if (error) throw error;

      const userIds = [...new Set((events || []).map((e: { user_id: string }) => e.user_id))];
      const { data: users } = userIds.length > 0
        ? await supabase.from("users").select("id, email").in("id", userIds)
        : { data: [] };

      const emailMap: Record<string, string> = {};
      (users || []).forEach((u: { id: string; email: string }) => { emailMap[u.id] = u.email; });

      const enriched = (events || []).map((e: Record<string, unknown>) => ({
        ...e,
        user_email: emailMap[e.user_id as string] || "unknown",
      }));

      return json({ events: enriched });
    }

    // ── Screenshots ──
    if (resource === "screenshots" && req.method === "GET") {
      const userId = url.searchParams.get("user_id");
      const date = url.searchParams.get("date"); // YYYY-MM-DD

      let query = supabase
        .from("screenshots")
        .select("id, user_id, storage_path, taken_at, is_blurred, session_id")
        .order("taken_at", { ascending: false });

      if (userId && isUUID(userId)) query = query.eq("user_id", userId);
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        query = query.gte("taken_at", `${date}T00:00:00Z`).lt("taken_at", `${date}T23:59:59.999Z`);
      }
      query = query.limit(200);

      const { data: screenshots, error } = await query;
      if (error) throw error;

      // Generate signed URLs (60s)
      const withUrls = await Promise.all(
        (screenshots || []).map(async (s: Record<string, unknown>) => {
          const { data: signedData } = await supabase.storage
            .from("screenshots")
            .createSignedUrl(s.storage_path as string, 60);
          return { ...s, signed_url: signedData?.signedUrl || null };
        })
      );

      // Get user info
      const userIds = [...new Set(withUrls.map((s) => s.user_id as string))];
      const { data: users } = userIds.length > 0
        ? await supabase.from("users").select("id, email, first_name, last_name").in("id", userIds)
        : { data: [] };
      const userMap: Record<string, { email: string; first_name: string; last_name: string }> = {};
      (users || []).forEach((u: { id: string; email: string; first_name: string; last_name: string }) => {
        userMap[u.id] = u;
      });

      const enriched = withUrls.map((s) => ({
        ...s,
        user: userMap[s.user_id as string] || null,
      }));

      return json({ screenshots: enriched });
    }

    if (resource === "screenshots" && req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      if (!contentType.includes("multipart/form-data")) {
        return json({ error: "Expected multipart/form-data" }, 400);
      }

      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const userId = formData.get("user_id") as string | null;

      if (!file || !userId || !isUUID(userId)) {
        return json({ error: "file and valid user_id are required" }, 400);
      }

      const allowedTypes = ["image/png", "image/jpeg"];
      if (!allowedTypes.includes(file.type)) {
        return json({ error: "Only PNG and JPEG files are allowed" }, 400);
      }

      const storagePath = `${userId}/${Date.now()}.png`;
      const fileBuffer = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("screenshots")
        .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return json({ error: `Upload failed: ${uploadError.message}` }, 500);
      }

      const { data: record, error: insertError } = await supabase
        .from("screenshots")
        .insert({
          session_id: null,
          user_id: userId,
          storage_path: storagePath,
          taken_at: new Date().toISOString(),
          is_blurred: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error("DB insert error:", insertError);
        return json({ error: `DB insert failed: ${insertError.message}` }, 500);
      }

      return json({ success: true, screenshot: record }, 201);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Admin error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
