"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/app/top-nav";
import { useSession, ROLE_LABEL } from "@/lib/session";
import { ROLE_LOGIN_EMAIL } from "@/lib/api";
import { useLoginMutation } from "@/lib/queries";
import type { Role } from "@/lib/api-types";

const ROLES: Role[] = ["sales_rep", "manager"];

export default function Login() {
  const { signIn } = useSession();
  const router = useRouter();
  const loginMutation = useLoginMutation();
  const [pendingRole, setPendingRole] = useState<Role | null>(null);

  const submit = (role: Role) => {
    setPendingRole(role);
    loginMutation.mutate(
      { email: ROLE_LOGIN_EMAIL[role], role },
      {
        onSuccess: (data) => {
          signIn(data.accessToken, data.email, data.role);
          router.push("/deals");
        },
        onError: (error) => {
          toast.error("Sign in failed", { description: error.message });
        },
        onSettled: () => setPendingRole(null),
      },
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="rounded-xl border border-border bg-card p-8 shadow-lift">
          <LogoMark size={40} />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Deal Discount Review</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to review and approve deals
          </p>

          <div className="mt-7 space-y-2.5">
            {ROLES.map((role) => (
              <Button
                key={role}
                type="button"
                variant={role === "sales_rep" ? "default" : "outline"}
                className="w-full justify-between"
                disabled={loginMutation.isPending}
                onClick={() => submit(role)}
              >
                <span>Sign in as {ROLE_LABEL[role]}</span>
                {loginMutation.isPending && pendingRole === role && (
                  <span className="text-xs text-muted-foreground">Signing in…</span>
                )}
              </Button>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">
              Reps edit line items. Managers review and approve.
            </p>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Internal tool · Pricing &amp; Deal Desk
        </p>
      </div>
    </main>
  );
}
