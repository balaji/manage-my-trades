'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getMe, logoutUser, deleteAccount, type UserInfo } from '@/lib/api/auth';

export type { UserInfo };

type AuthContextType = {
  user: UserInfo | null;
  authLoading: boolean;
  login: () => void;
  logout: () => void;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  authLoading: true,
  login: () => {},
  logout: () => {},
  deleteAccount: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const authMessageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (authMessageHandlerRef.current) {
        window.removeEventListener('message', authMessageHandlerRef.current);
        authMessageHandlerRef.current = null;
      }
    };
  }, []);

  const login = useCallback(() => {
    const loginUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://myapp.net:8000/api/v1'}/auth/google/login`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    if (authMessageHandlerRef.current) {
      window.removeEventListener('message', authMessageHandlerRef.current);
      authMessageHandlerRef.current = null;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'AUTH_SUCCESS') {
        window.removeEventListener('message', handleMessage);
        authMessageHandlerRef.current = null;
        getMe()
          .then(setUser)
          .catch(() => setUser(null));
      }
    };

    authMessageHandlerRef.current = handleMessage;
    window.addEventListener('message', handleMessage);

    const popup = window.open(
      loginUrl,
      'google_oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
      window.removeEventListener('message', handleMessage);
      authMessageHandlerRef.current = null;
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const deleteAccountFn = useCallback(async () => {
    await deleteAccount();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, authLoading, login, logout, deleteAccount: deleteAccountFn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
