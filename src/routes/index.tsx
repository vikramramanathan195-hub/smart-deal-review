import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogoMark } from "@/components/app/top-nav";
import { useSession } from "@/lib/session";
import type { Role } from "@/lib/deal-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign In · Deal Discount Review" },
      {
        name: "description",
        content:
          "Sign in to Deal Discount Review to build multi-line deals, review AI discount recommendations, and check deals against pricing policy.",
      },
      { property: "og:title", content: "Sign In · Deal Discount Review" },
      {
        property: "og:description",
        content: "Internal discount review tool for sales reps and approving managers.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Sales Rep");
  const [emailError, setEmailError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setEmailError("Enter your work email to continue");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address, like name@company.com");
      return;
    }
    setEmailError(null);
    signIn(email.trim(), role);
    navigate({ to: "/deals" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <form
          onSubmit={submit}
          className="rounded-xl border border-border bg-card p-8 shadow-lift"
          noValidate
        >
          <LogoMark size={40} />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Deal Discount Review</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to review and approve deals
          </p>

          <div className="mt-7 space-y-5">
            <div>
              <label className="label-caps" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                className="mt-1.5"
                aria-invalid={!!emailError}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {emailError && <p className="mt-1.5 text-xs font-medium text-danger">{emailError}</p>}
            </div>

            <div>
              <label className="label-caps">Role</label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sales Rep">Sales Rep</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Reps edit line items. Managers review and approve.
              </p>
            </div>

            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </div>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Internal tool · Pricing &amp; Deal Desk
        </p>
      </div>
    </main>
  );
}
