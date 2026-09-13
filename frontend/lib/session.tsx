"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/api-types";

export type { Role };

export const ROLE_LABEL: Record<Role, string> = {
  sales_rep: "Sales Rep",
  manager: "Manager",
};

type Session = {
  token: string | null;
  email: string | null;
  role: Role | null;
  isSignedIn: boolean;
  /** False until the stored session has been read on the client. Pages wait
   * for this before deciding someone is signed out, otherwise a refresh
   * would bounce to sign-in a moment before the session loads. */
  ready: boolean;
  signIn: (token: string, email: string, role: Role) => void;
  signOut: () => void;
};

const STORAGE_KEY = "ddr:session";

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  // Read after mount rather than in the initializer so the server and the
  // first client render agree (no session), then hydrate from storage.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as { token: string; email: string; role: Role };
        if (stored.token && stored.email && stored.role) {
          setToken(stored.token);
          setEmail(stored.email);
          setRole(stored.role);
        }
      }
    } catch {
      // Unreadable storage just means signed out.
    }
    setReady(true);
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setEmail(null);
    setRole(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  }, []);

  const router = useRouter();
  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      router.replace("/sign-in");
    };
    document.addEventListener("session:unauthorized", onUnauthorized);
    return () => document.removeEventListener("session:unauthorized", onUnauthorized);
  }, [clearSession, router]);

  const value = useMemo<Session>(
    () => ({
      token,
      email,
      role,
      isSignedIn: !!token,
      ready,
      signIn: (nextToken, nextEmail, nextRole) => {
        setToken(nextToken);
        setEmail(nextEmail);
        setRole(nextRole);
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ token: nextToken, email: nextEmail, role: nextRole }),
          );
        } catch {
          // Storage can be unavailable (private mode); the session still works for this tab.
        }
      },
      signOut: clearSession,
    }),
    [token, email, role, ready, clearSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
