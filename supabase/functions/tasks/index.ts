import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getCorsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

function isUUID(v: unknown): boolean {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

const VALID_STATUSES = ["TODO", "IN_PROGRESS", "DONE"];
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, payload, signature] = token.split(".");
    const encoder = new TextEncoder();
    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sig = signature.replace(/-/g, "+").replace(/_/g, "/");
    const padded = sig + "=".repeat((4 - (sig.length % 4)) % 4);
    const sigBytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(data));
    if (!valid) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (decoded.exp && decoded.exp < Date.now() / 1000) return null;
    return decoded;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const jwtSecret = Deno.env.get("JWT_SECRET");
    if (!jwtSecret) return new Response(JSON.stringify({ error: "Server config error" }), { status: 500, headers: cors });

    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const claims = await verifyJWT(auth, jwtSecret);
    if (!claims) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: cors });

    const userId = claims.sub as string;
    const userRole = claims.role as string;
    const userTeamId = claims.team_id as string | null;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const path = url.pathname.split("/").filter(Boolean).pop() || "";

    async function logActivity(taskId: string, action: string, details: Record<string, unknown>) {
      try {
        await sb.from("task_activity").insert({ task_id: taskId, actor_id: userId, action, details });
      } catch (_) { /* non-fatal */ }
    }

    // GET /activity?task_id=...
    if (req.method === "GET" && path === "activity") {
      const taskId = url.searchParams.get("task_id");
      if (!taskId || !isUUID(taskId)) {
        return new Response(JSON.stringify({ error: "Valid task_id required" }), { status: 400, headers: cors });
      }
      const { data: activity, error } = await sb
        .from("task_activity")
        .select("*, actor:users!task_activity_actor_id_fkey(id, first_name, last_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) {
        // fallback without join if FK not present
        const { data: act2 } = await sb.from("task_activity").select("*").eq("task_id", taskId).order("created_at", { ascending: false });
        const actorIds = [...new Set((act2 || []).map((a) => a.actor_id))];
        const { data: usersData } = await sb.from("users").select("id, first_name, last_name").in("id", actorIds.length ? actorIds : ["00000000-0000-0000-0000-000000000000"]);
        const userMap = new Map((usersData || []).map((u) => [u.id, u]));
        const enriched = (act2 || []).map((a) => ({ ...a, actor: userMap.get(a.actor_id) || null }));
        return new Response(JSON.stringify({ activity: enriched }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ activity }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // GET /tasks - list tasks
    if (req.method === "GET" && path === "tasks") {
      const status = url.searchParams.get("status");
      const assignee = url.searchParams.get("assignee");

      let query = sb.from("tasks").select("*, assignee:users!tasks_assignee_id_fkey(id, first_name, last_name, email), creator:users!tasks_created_by_fkey(id, first_name, last_name)");

      // Scope: employees see only their tasks, managers see team tasks, admins see all
      if (userRole === "EMPLOYEE") {
        query = query.eq("assignee_id", userId);
      } else if (userRole === "MANAGER" && userTeamId) {
        query = query.eq("team_id", userTeamId);
      }
      // ADMIN sees all

      if (status && VALID_STATUSES.includes(status)) {
        query = query.eq("status", status);
      }
      if (assignee && isUUID(assignee)) {
        query = query.eq("assignee_id", assignee);
      }

      query = query.order("position", { ascending: true }).order("created_at", { ascending: false });

      const { data: tasks, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ tasks }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // POST /tasks - create task
    if (req.method === "POST" && path === "tasks") {
      const body = await req.json();
      const { title, description, assignee_id, priority, due_date, status: taskStatus } = body;

      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Title is required" }), { status: 400, headers: cors });
      }
      if (!assignee_id || !isUUID(assignee_id)) {
        return new Response(JSON.stringify({ error: "Valid assignee_id is required" }), { status: 400, headers: cors });
      }

      // Employees can only assign to themselves
      if (userRole === "EMPLOYEE" && assignee_id !== userId) {
        return new Response(JSON.stringify({ error: "You can only create tasks for yourself" }), { status: 403, headers: cors });
      }

      // Get max position for the target status
      const targetStatus = (taskStatus && VALID_STATUSES.includes(taskStatus)) ? taskStatus : "TODO";
      const { data: maxPos } = await sb.from("tasks").select("position").eq("status", targetStatus).order("position", { ascending: false }).limit(1);
      const nextPos = (maxPos && maxPos.length > 0) ? maxPos[0].position + 1 : 0;

      // Determine team_id from assignee
      const { data: assigneeData } = await sb.from("users").select("team_id").eq("id", assignee_id).single();

      const { data: task, error } = await sb.from("tasks").insert({
        title: title.trim(),
        description: description?.trim() || null,
        status: targetStatus,
        priority: (priority && VALID_PRIORITIES.includes(priority)) ? priority : "MEDIUM",
        assignee_id,
        created_by: userId,
        team_id: assigneeData?.team_id || userTeamId || null,
        due_date: due_date || null,
        position: nextPos,
      }).select("*, assignee:users!tasks_assignee_id_fkey(id, first_name, last_name, email), creator:users!tasks_created_by_fkey(id, first_name, last_name)").single();

      if (error) throw error;
      await logActivity(task.id, "CREATED", { title: task.title, status: task.status, priority: task.priority, assignee_id: task.assignee_id });
      return new Response(JSON.stringify({ task }), { status: 201, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // PATCH /tasks - update task
    if (req.method === "PATCH" && path === "tasks") {
      const body = await req.json();
      const { id, title, description, status: newStatus, priority, assignee_id, due_date, position } = body;

      if (!id || !isUUID(id)) {
        return new Response(JSON.stringify({ error: "Valid task id is required" }), { status: 400, headers: cors });
      }

      // Check ownership / permission
      const { data: existing } = await sb.from("tasks").select("*").eq("id", id).single();
      if (!existing) return new Response(JSON.stringify({ error: "Task not found" }), { status: 404, headers: cors });

      if (userRole === "EMPLOYEE" && existing.assignee_id !== userId) {
        return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: cors });
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title.trim();
      if (description !== undefined) updates.description = description?.trim() || null;
      if (newStatus && VALID_STATUSES.includes(newStatus)) updates.status = newStatus;
      if (priority && VALID_PRIORITIES.includes(priority)) updates.priority = priority;
      if (assignee_id && isUUID(assignee_id)) updates.assignee_id = assignee_id;
      if (due_date !== undefined) updates.due_date = due_date || null;
      if (position !== undefined && typeof position === "number") updates.position = position;

      const { data: task, error } = await sb.from("tasks").update(updates).eq("id", id)
        .select("*, assignee:users!tasks_assignee_id_fkey(id, first_name, last_name, email), creator:users!tasks_created_by_fkey(id, first_name, last_name)").single();

      if (error) throw error;

      // Log granular activity for each meaningful change
      const trackFields: Array<{ key: string; action: string }> = [
        { key: "status", action: "STATUS_CHANGED" },
        { key: "priority", action: "PRIORITY_CHANGED" },
        { key: "assignee_id", action: "ASSIGNEE_CHANGED" },
        { key: "title", action: "TITLE_CHANGED" },
        { key: "description", action: "DESCRIPTION_CHANGED" },
        { key: "due_date", action: "DUE_DATE_CHANGED" },
      ];
      for (const f of trackFields) {
        if (updates[f.key] !== undefined && existing[f.key] !== updates[f.key]) {
          await logActivity(id, f.action, { from: existing[f.key], to: updates[f.key] });
        }
      }
      return new Response(JSON.stringify({ task }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // DELETE /tasks
    if (req.method === "DELETE" && path === "tasks") {
      const { id } = await req.json();
      if (!id || !isUUID(id)) {
        return new Response(JSON.stringify({ error: "Valid task id is required" }), { status: 400, headers: cors });
      }

      const { data: existing } = await sb.from("tasks").select("created_by, assignee_id").eq("id", id).single();
      if (!existing) return new Response(JSON.stringify({ error: "Task not found" }), { status: 404, headers: cors });

      // Only creator, assignee, or admin/manager can delete
      if (userRole === "EMPLOYEE" && existing.created_by !== userId && existing.assignee_id !== userId) {
        return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: cors });
      }

      // Log BEFORE delete since we lose the row after
      await logActivity(id, "DELETED", { task_id: id });
      const { error } = await sb.from("tasks").delete().eq("id", id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), { status: 500, headers: getCorsHeaders(req) });
  }
});
