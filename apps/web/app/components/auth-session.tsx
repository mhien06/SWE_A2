"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  clearSession,
  getSessionSnapshot,
  saveSession,
  subscribeSession,
  type ApiSession,
} from "../lib/api";

type AuthContextValue = {
  session: ApiSession | null;
  ready: boolean;
  setSession: (session: ApiSession) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    () => null,
  );
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const value: AuthContextValue = {
    session,
    ready,
    setSession: saveSession,
    signOut: clearSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthSession must be used inside AuthSessionProvider");
  }
  return context;
}
