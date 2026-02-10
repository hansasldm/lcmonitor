const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1/auth`;

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "EMPLOYEE" | "MANAGER" | "ADMIN";
  team_id: string | null;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

function setToken(token: string) {
  localStorage.setItem("auth_token", token);
}

function clearToken() {
  localStorage.removeItem("auth_token");
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("auth_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStoredUser(user: AuthUser) {
  localStorage.setItem("auth_user", JSON.stringify(user));
}

function clearStoredUser() {
  localStorage.removeItem("auth_user");
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${FUNCTIONS_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  setToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function signup(
  email: string,
  password: string,
  first_name: string,
  last_name: string,
  role?: string
): Promise<AuthResponse> {
  const res = await fetch(`${FUNCTIONS_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, first_name, last_name, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Signup failed");
  setToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${FUNCTIONS_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    clearToken();
    clearStoredUser();
    return null;
  }
  const data = await res.json();
  setStoredUser(data.user);
  return data.user;
}

export function logout() {
  clearToken();
  clearStoredUser();
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
