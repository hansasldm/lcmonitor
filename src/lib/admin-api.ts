import { getAuthHeaders } from "@/lib/auth";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin`;

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

export const adminApi = {
  getStats: () => request("stats"),
  
  getUsers: () => request("users"),
  createUser: (body: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: string;
    team_id?: string | null;
    status?: string;
  }) => request("users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: Record<string, unknown>) =>
    request(`users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  getTeams: () => request("teams"),
  createTeam: (body: { name: string; manager_id?: string | null }) =>
    request("teams", { method: "POST", body: JSON.stringify(body) }),
  updateTeam: (id: string, body: Record<string, unknown>) =>
    request(`teams/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  getTeamMembers: (teamId: string) => request(`teams/${teamId}/members`),
  addTeamMembers: (teamId: string, userIds: string[]) =>
    request(`teams/${teamId}/members`, { method: "POST", body: JSON.stringify({ user_ids: userIds }) }),
  removeTeamMember: (teamId: string, userId: string) =>
    request(`teams/${teamId}/members`, { method: "DELETE", body: JSON.stringify({ user_id: userId }) }),
};
