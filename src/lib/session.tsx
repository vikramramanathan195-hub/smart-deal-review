import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Role } from "./deal-data";

type Session = {
  email: string;
  role: Role;
  signIn: (email: string, role: Role) => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Sales Rep");

  const value = useMemo<Session>(
    () => ({
      email,
      role,
      signIn: (nextEmail, nextRole) => {
        setEmail(nextEmail);
        setRole(nextRole);
      },
    }),
    [email, role],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
