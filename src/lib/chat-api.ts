import { getAuthHeaders } from "@/lib/auth";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

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

export interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  group_type: string;
  created_by: string;
  created_at: string;
}

export interface ChatMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user: { id: string; email: string; first_name: string; last_name: string } | null;
}

export interface ChatMessage {
  id: string;
  group_id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
  edited_at: string | null;
  is_deleted: boolean;
  sender: { id: string; email: string; first_name: string; last_name: string } | null;
}

export const chatApi = {
  getGroups: (): Promise<{ groups: ChatGroup[] }> => request("groups"),

  createGroup: (body: {
    name: string;
    description?: string;
    group_type?: string;
    member_ids?: string[];
  }): Promise<{ group: ChatGroup }> =>
    request("groups", { method: "POST", body: JSON.stringify(body) }),

  getMembers: (groupId: string): Promise<{ members: ChatMember[] }> =>
    request(`groups/${groupId}/members`),

  addMembers: (groupId: string, userIds: string[]): Promise<{ success: boolean }> =>
    request(`groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify({ user_ids: userIds }),
    }),

  removeMember: (groupId: string, userId: string): Promise<{ success: boolean }> =>
    request(`groups/${groupId}/members`, {
      method: "DELETE",
      body: JSON.stringify({ user_id: userId }),
    }),

  getMessages: (groupId: string, limit = 50, before?: string): Promise<{ messages: ChatMessage[] }> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set("before", before);
    return request(`groups/${groupId}/messages?${params}`);
  },

  sendMessage: (groupId: string, messageText: string): Promise<{ message: ChatMessage }> =>
    request(`groups/${groupId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message_text: messageText }),
    }),
};
