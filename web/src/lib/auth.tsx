'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { apiFetch } from './api';
import type { Account, Agent } from './types';

const STORAGE_KEY = 'saturn_session';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredSession {
  apiKey: string;
  expiresAt: number;
}

function saveSession(apiKey: string): void {
  const session: StoredSession = {
    apiKey,
    expiresAt: Date.now() + SESSION_MAX_AGE_MS,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function loadSession(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session: StoredSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session.apiKey;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

interface AuthState {
  apiKey: string | null;
  account: Account | null;
  agent: Agent | null;
  isLoading: boolean;
  login: (key: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  apiKey: null,
  account: null,
  agent: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearSession();
    setApiKey(null);
    setAccount(null);
    setAgent(null);
  }, []);

  const validate = useCallback(
    async (key: string) => {
      try {
        const data = await apiFetch<Account>('/v1/accounts/me', {
          apiKey: key,
        });
        setAccount(data);
        setApiKey(key);
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    },
    [logout],
  );

  useEffect(() => {
    const stored = loadSession();
    if (stored) {
      validate(stored);
    } else {
      setIsLoading(false);
    }
  }, [validate]);

  const login = useCallback(
    (key: string) => {
      saveSession(key);
      setApiKey(key);
      setIsLoading(true);
      validate(key);
    },
    [validate],
  );

  return (
    <AuthContext.Provider
      value={{ apiKey, account, agent, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { apiKey, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!apiKey) {
    if (typeof window !== 'undefined') {
      window.location.href = '/signup';
    }
    return null;
  }

  return <>{children}</>;
}
