"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
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
  signIn: (token: string, email: string, role: Role) => void;
  signOut: () => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  const value = useMemo<Session>(
    () => ({
      token,
      email,
      role,
      isSignedIn: !!token,
      signIn: (nextToken, nextEmail, nextRole) => {
        setToken(nextToken);
        setEmail(nextEmail);
        setRole(nextRole);
      },
      signOut: () => {
        setToken(null);
        setEmail(null);
        setRole(null);
      },
    }),
    [token, email, role],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
