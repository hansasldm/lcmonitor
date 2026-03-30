import { getAuthHeaders } from "@/lib/auth";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tasks`;

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

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assignee_id: string;
  created_by: string;
  team_id: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  assignee?: { id: string; first_name: string; last_name: string; email: string } | null;
  creator?: { id: string; first_name: string; last_name: string } | null;
}

export const tasksApi = {
  list: (params?: { status?: string; assignee?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.assignee) qs.set("assignee", params.assignee);
    const query = qs.toString();
    return request(`tasks${query ? `?${query}` : ""}`);
  },

  create: (data: { title: string; description?: string; assignee_id: string; priority?: string; due_date?: string; status?: string }) =>
    request("tasks", { method: "POST", body: JSON.stringify(data) }),

  update: (data: { id: string; title?: string; description?: string; status?: string; priority?: string; assignee_id?: string; due_date?: string; position?: number }) =>
    request("tasks", { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: string) =>
    request("tasks", { method: "DELETE", body: JSON.stringify({ id }) }),
};
