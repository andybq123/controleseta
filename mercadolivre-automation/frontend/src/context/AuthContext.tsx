import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "../lib/api";

interface AuthContextValue {
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<{ username: string }>("/auth/me")
      .then((data) => setUsername(data.username))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(usernameInput: string, password: string) {
    const data = await api<{ token: string; username: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: usernameInput, password }),
    });
    setToken(data.token);
    setUsername(data.username);
  }

  function logout() {
    setToken(null);
    setUsername(null);
  }

  return (
    <AuthContext.Provider value={{ username, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
