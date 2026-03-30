import { getAuthHeaders } from "@/lib/auth";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/work-sessions`;

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
};