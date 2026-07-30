import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "./api";
import type { Usuario } from "./types";

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCargando(false);
      return;
    }
    api
      .get<{ usuario: Usuario }>("/auth/me")
      .then((res) => setUsuario(res.usuario))
      .catch(() => setToken(null))
      .finally(() => setCargando(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; usuario: Usuario }>("/auth/login", { email, password });
    setToken(res.token);
    setUsuario(res.usuario);
  }

  function logout() {
    setToken(null);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
