import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  AuthUser,
  login as authLogin,
  signup as authSignup,
  logout as authLogout,
  fetchCurrentUser,
  getStoredUser,
  isAuthenticated as checkAuth,
} from "@/lib/auth";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string, role?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (checkAuth()) {
      fetchCurrentUser()
        .then((u) => setUser(u))
        .catch(() => setUser(null))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authLogin(email, password);
    setUser(res.user);
  }, []);

  const signup = useCallback(
    async (email: string, password: string, firstName: string, lastName: string, role?: string) => {
      const res = await authSignup(email, password, firstName, lastName, role);
      setUser(res.user);
    },
    []
  );

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
