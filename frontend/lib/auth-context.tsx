"use client";

/**
 * Contexto de sesión: usuario actual + acciones de auth.
 * Al montar, restaura la sesión desde el refresh token (si existe).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  clearSession,
  fetchMe,
  hasStoredSession,
  login as apiLogin,
  register as apiRegister,
  type UserPublic,
} from "@/lib/api";

type AuthContextValue = {
  user: UserPublic | null;
  /** true mientras se restaura la sesión inicial */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasStoredSession()) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await apiLogin(email, password));
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      setUser(await apiRegister(email, password, displayName));
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
