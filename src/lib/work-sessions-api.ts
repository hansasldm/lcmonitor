import { getAuthHeaders } from "@/lib/auth";

// In production, route through local PHP proxy to bypass Edge Function CORS
const IS_PROD = import.meta.env.PROD;
const BASE = IS_PROD
  ? `/supabase-proxy.php?path=work-sessions`
  : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/work-sessions`;

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const workSessionsApi = {
  getStatus: () => request("status"),
  clockIn: () => request("clock-in", { method: "POST" }),
  clockOut: () => request("clock-out", { method: "POST" }),
  breakIn: () => request("break-in", { method: "POST" }),
  breakOut: () => request("break-out", { method: "POST" }),
  getActiveNow: () => request("active-now"),
  getTeamOverview: (period: "today" | "week" = "today") =>
    request(`team-overview?period=${period}`),
  getHistory: (days = 14) => request(`history?days=${days}`),
  updateNotes: (session_id: string, notes: string) =>
    request("notes", { method: "PATCH", body: JSON.stringify({ session_id, notes }) }),
  getBrowserHistory: (userId: string, date: string) =>
    request(`browser-history?user_id=${userId}&date=${date}`),
  addBrowserHistory: (history: Array<{ url: string; title?: string; duration_seconds: number; visited_at: string; session_id?: string }>) =>
    request("browser-history", { method: "POST", body: JSON.stringify(history) }),
};