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

async function requireAuth(req: Request, jwtSecret: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return await verifyJWT(authHeader.replace("Bearer ", ""), jwtSecret);
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwtSecret = Deno.env.get("JWT_SECRET")!;

  const claims = await requireAuth(req, jwtSecret);
  if (!claims) return json({ error: "Unauthorized" }, 401);

  const userId = (claims.user_id || claims.sub) as string;
  const userRole = claims.role as string;

  if (!userId) return json({ error: "Invalid token: no user ID" }, 401);

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const chatIdx = pathParts.indexOf("chat");
  const after = chatIdx >= 0 ? pathParts.slice(chatIdx + 1) : pathParts;
  const resource = after[0] || "";
  const resourceId = after[1] || null;
  const subResource = after[2] || null;

  try {
    // ── GET /groups — list groups user belongs to ──
    if (resource === "groups" && req.method === "GET" && !resourceId) {
      const { data: memberships, error: memErr } = await supabase
        .from("chat_group_members")
        .select("group_id")
        .eq("user_id", userId);
      if (memErr) throw memErr;

      const groupIds = (memberships || []).map((m: { group_id: string }) => m.group_id);
      if (groupIds.length === 0) return json({ groups: [] });

      const { data: groups, error } = await supabase
        .from("chat_groups")
        .select("*")
        .in("id", groupIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ groups });
    }

    // ── POST /groups — create group (admin only) ──
    if (resource === "groups" && req.method === "POST" && !resourceId) {
      if (userRole !== "ADMIN") return json({ error: "Only admins can create groups" }, 403);
      const body = await req.json().catch(() => ({}));
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 200) return json({ error: "Name required (1-200 chars)" }, 400);

      const { data: group, error } = await supabase
        .from("chat_groups")
        .insert({
          name,
          description: typeof body.description === "string" ? body.description.trim() : null,
          group_type: ["GENERAL", "TEAM", "PROJECT"].includes(body.group_type) ? body.group_type : "GENERAL",
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;

      // Auto-add creator as admin member
      await supabase.from("chat_group_members").insert({ group_id: group.id, user_id: userId, role: "ADMIN" });

      // Add additional members if provided
      if (Array.isArray(body.member_ids)) {
        const members = body.member_ids.filter((id: unknown) => isUUID(id) && id !== userId);
        if (members.length > 0) {
          await supabase.from("chat_group_members").insert(
            members.map((uid: string) => ({ group_id: group.id, user_id: uid, role: "MEMBER" }))
          );
        }
      }

      return json({ group }, 201);
    }

    // ── GET /groups/:id/members ──
    if (resource === "groups" && resourceId && subResource === "members" && req.method === "GET") {
      if (!isUUID(resourceId)) return json({ error: "Invalid group ID" }, 400);

      // Check membership
      const { data: mem } = await supabase
        .from("chat_group_members")
        .select("id")
        .eq("group_id", resourceId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!mem && userRole !== "ADMIN") return json({ error: "Not a member" }, 403);

      const { data: members, error } = await supabase
        .from("chat_group_members")
        .select("id, user_id, role, joined_at")
        .eq("group_id", resourceId);
      if (error) throw error;

      const userIds = (members || []).map((m: { user_id: string }) => m.user_id);
      const { data: users } = userIds.length > 0
        ? await supabase.from("users").select("id, email, first_name, last_name").in("id", userIds)
        : { data: [] };

      const userMap: Record<string, unknown> = {};
      (users || []).forEach((u: { id: string }) => { userMap[u.id] = u; });

      const enriched = (members || []).map((m: { user_id: string }) => ({
        ...m,
        user: userMap[m.user_id] || null,
      }));

      return json({ members: enriched });
    }

    // ── POST /groups/:id/members — add members (admin only) ──
    if (resource === "groups" && resourceId && subResource === "members" && req.method === "POST") {
      if (userRole !== "ADMIN") return json({ error: "Only admins can add members" }, 403);
      if (!isUUID(resourceId)) return json({ error: "Invalid group ID" }, 400);

      const body = await req.json().catch(() => ({}));
      const userIds = Array.isArray(body.user_ids) ? body.user_ids.filter(isUUID) : [];
      if (userIds.length === 0) return json({ error: "user_ids required" }, 400);

      const rows = userIds.map((uid: string) => ({ group_id: resourceId, user_id: uid, role: "MEMBER" }));
      const { error } = await supabase.from("chat_group_members").upsert(rows, { onConflict: "group_id,user_id" });
      if (error) throw error;
      return json({ success: true, added: userIds.length });
    }

    // ── DELETE /groups/:id/members — remove member (admin only) ──
    if (resource === "groups" && resourceId && subResource === "members" && req.method === "DELETE") {
      if (userRole !== "ADMIN") return json({ error: "Only admins can remove members" }, 403);
      if (!isUUID(resourceId)) return json({ error: "Invalid group ID" }, 400);

      const body = await req.json().catch(() => ({}));
      if (!isUUID(body.user_id)) return json({ error: "Valid user_id required" }, 400);

      const { error } = await supabase
        .from("chat_group_members")
        .delete()
        .eq("group_id", resourceId)
        .eq("user_id", body.user_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ── GET /groups/:id/messages ──
    if (resource === "groups" && resourceId && subResource === "messages" && req.method === "GET") {
      if (!isUUID(resourceId)) return json({ error: "Invalid group ID" }, 400);

      // Check membership
      const { data: mem } = await supabase
        .from("chat_group_members")
        .select("id")
        .eq("group_id", resourceId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!mem && userRole !== "ADMIN") return json({ error: "Not a member" }, 403);

      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
      const before = url.searchParams.get("before"); // cursor pagination

      let query = supabase
        .from("chat_messages")
        .select("*")
        .eq("group_id", resourceId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (before) query = query.lt("created_at", before);

      const { data: messages, error } = await query;
      if (error) throw error;

      // Get sender info
      const senderIds = [...new Set((messages || []).map((m: { sender_id: string }) => m.sender_id))];
      const { data: senders } = senderIds.length > 0
        ? await supabase.from("users").select("id, email, first_name, last_name").in("id", senderIds)
        : { data: [] };

      const senderMap: Record<string, unknown> = {};
      (senders || []).forEach((u: { id: string }) => { senderMap[u.id] = u; });

      const enriched = (messages || []).map((m: { sender_id: string }) => ({
        ...m,
        sender: senderMap[m.sender_id] || null,
      }));

      return json({ messages: enriched.reverse() });
    }

    // ── POST /groups/:id/messages — send message ──
    if (resource === "groups" && resourceId && subResource === "messages" && req.method === "POST") {
      if (!isUUID(resourceId)) return json({ error: "Invalid group ID" }, 400);

      // Check membership
      const { data: mem } = await supabase
        .from("chat_group_members")
        .select("id")
        .eq("group_id", resourceId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!mem) return json({ error: "Not a member of this group" }, 403);

      const body = await req.json().catch(() => ({}));
      const text = typeof body.message_text === "string" ? body.message_text.trim() : "";
      if (!text || text.length > 5000) return json({ error: "Message required (1-5000 chars)" }, 400);

      const { data: message, error } = await supabase
        .from("chat_messages")
        .insert({ group_id: resourceId, sender_id: userId, message_text: text })
        .select()
        .single();
      if (error) throw error;

      return json({ message }, 201);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "Internal server error" }, 500);
  }
});
