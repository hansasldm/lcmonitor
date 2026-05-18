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

// ── Rate limiting (in-memory, per-isolate) ──
const attempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 min

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
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

// ── PBKDF2 password hashing (replaces SHA-256) ──
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

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  if (storedHash.startsWith("pbkdf2:")) {
    const [, saltHex, hashHex] = storedHash.split(":");
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]
    );
    const hash = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial, 256
    );
    const computed = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return computed === hashHex;
  }
  // Legacy SHA-256 fallback
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password));
  const computed = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === storedHash;
}

// ── JWT helpers (unchanged logic) ──
async function createJWT(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const data = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${data}.${encodedSignature}`;
}

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

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const jwtSecret = Deno.env.get("JWT_SECRET");
  if (!jwtSecret) {
    return json({ error: "Server configuration error" }, 500);
  }

  // Rate limit login and signup by IP
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    // ── LOGIN ──
    if (path === "login" && req.method === "POST") {
      if (!checkRateLimit(clientIp)) {
        return json({ error: "Too many login attempts. Try again later." }, 429);
      }

      const body = await req.json().catch(() => ({}));
      const email = validateEmail(body.email);
      const password = validatePassword(body.password);
      if (!email || !password) {
        return json({ error: "Valid email and password (8-128 chars) are required" }, 400);
      }

      const { data: user, error } = await supabase
        .from("users")
        .select("id, email, password_hash, first_name, last_name, role, team_id, status, monitor_token")
        .eq("email", email)
        .maybeSingle();

      if (error || !user) {
        return json({ error: "Invalid credentials" }, 401);
      }
      if (user.status === "INACTIVE") {
        return json({ error: "Account is inactive" }, 403);
      }

      const passwordValid = await verifyPassword(password, user.password_hash);
      if (!passwordValid) {
        return json({ error: "Invalid credentials" }, 401);
      }

      // Migrate legacy SHA-256 hash to PBKDF2 on successful login
      if (!user.password_hash.startsWith("pbkdf2:")) {
        const newHash = await hashPasswordPBKDF2(password);
        await supabase.from("users").update({ password_hash: newHash }).eq("id", user.id);
      }

      const token = await createJWT(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          team_id: user.team_id,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        },
        jwtSecret
      );

      return json({
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          team_id: user.team_id,
          monitor_token: user.monitor_token,
        },
      });
    }

    // ── SIGNUP ──
    if (path === "signup" && req.method === "POST") {
      if (!checkRateLimit(clientIp)) {
        return json({ error: "Too many signup attempts. Try again later." }, 429);
      }

      const body = await req.json().catch(() => ({}));
      const email = validateEmail(body.email);
      const password = validatePassword(body.password);
      const first_name = validateStr(body.first_name);
      const last_name = validateStr(body.last_name);
      const role = body.role ? validateRole(body.role) : "EMPLOYEE";

      if (!email || !password || !first_name || !last_name || !role) {
        return json({ error: "Valid email, password (8-128 chars), first_name, and last_name are required" }, 400);
      }

      const passwordHash = await hashPasswordPBKDF2(password);
      const { data: newUser, error } = await supabase
        .from("users")
        .insert({
          email,
          password_hash: passwordHash,
          first_name,
          last_name,
          role,
        })
        .select("id, email, first_name, last_name, role, team_id")
        .single();

      if (error) {
        if (error.code === "23505") {
          return json({ error: "Email already registered" }, 409);
        }
        throw error;
      }

      const token = await createJWT(
        {
          sub: newUser.id,
          email: newUser.email,
          role: newUser.role,
          team_id: newUser.team_id,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        },
        jwtSecret
      );

      return json({ token, user: newUser }, 201);
    }

    // ── ME ──
    if (path === "me" && req.method === "GET") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ error: "Unauthorized" }, 401);
      }

      const claims = await verifyJWT(authHeader.replace("Bearer ", ""), jwtSecret);
      if (!claims) {
        return json({ error: "Invalid or expired token" }, 401);
      }

      const { data: user, error } = await supabase
        .from("users")
        .select("id, email, first_name, last_name, role, team_id, status")
        .eq("id", claims.sub)
        .maybeSingle();

      if (error || !user) {
        return json({ error: "User not found" }, 404);
      }

      return json({ user });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Auth error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
