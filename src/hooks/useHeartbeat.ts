import { useEffect, useRef } from "react";
import { getAuthHeaders } from "@/lib/auth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const HEARTBEAT_URL = `${SUPABASE_URL}/functions/v1/agent/heartbeat`;
const INTERVAL_MS = 30_000;

// Simple browser-based device ID (persisted per browser)
function getDeviceId(): string {
  const KEY = "heartbeat_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `browser-${crypto.randomUUID()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

async function sendHeartbeat() {
  try {
    const res = await fetch(HEARTBEAT_URL, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_id: getDeviceId(),
        os_type: "WINDOWS",
      }),
    });
    if (!res.ok) {
      console.warn("[Heartbeat] failed:", res.status, await res.text());
    } else {
      console.debug("[Heartbeat] sent OK");
    }
  } catch (err) {
    console.warn("[Heartbeat] error:", err);
  }
}

/** Sends a heartbeat every 30s while the user is authenticated. */
export function useHeartbeat(isAuthenticated: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    // Send immediately, then every 30s
    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isAuthenticated]);
}
