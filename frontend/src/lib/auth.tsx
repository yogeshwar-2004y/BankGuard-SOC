import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, queryClient, setCsrf } from './api';
import type { User } from '../types';
interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clear: () => void;
}
const AuthContext = createContext<AuthState | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const clear = () => {
    setUser(null);
    setCsrf('');
    queryClient.clear();
  };
  useEffect(() => {
    api<{ user: User; csrf_token: string }>('/auth/me')
      .then((data) => {
        setUser(data.user);
        setCsrf(data.csrf_token);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  const login = async (email: string, password: string) => {
    const data = await api<{ user: User; csrf_token: string }>('/auth/login', 'POST', {
      email,
      password,
    });
    setCsrf(data.csrf_token);
    queryClient.clear();
    setUser(data.user);
  };
  const logout = async () => {
    try {
      await api('/auth/logout', 'POST');
    } catch {
      // Expired sessions are already unusable; clear the browser's authenticated view.
      setUser(null);
    } finally {
      clear();
    }
  };
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, clear }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('Authentication provider is required.');
  return context;
}
