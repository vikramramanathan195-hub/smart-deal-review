"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Briefcase,
  ListChecks,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LogoMark } from "@/components/app/top-nav";
import { PolicyGauge } from "@/components/app/policy-gauge";
import { useSession, ROLE_LABEL } from "@/lib/session";
import { ROLE_LOGIN_EMAIL } from "@/lib/api";
import { useLoginMutation } from "@/lib/queries";
import { POLICY_CEILING_PCT } from "@/lib/deal-data";
import type { Role } from "@/lib/api-types";

const ROLE_CARDS: {
  role: Role;
  icon: typeof Briefcase;
  description: string;
}[] = [
  {
    role: "sales_rep",
    icon: Briefcase,
    description:
      "Build deals line by line, review each AI recommendation, and accept or propose a discount.",
  },
  {
    role: "manager",
    icon: ShieldCheck,
    description:
      "Review deals that exceed the policy ceiling, then approve or send them back with changes.",
  },
];

const VALUE_PROPS = [
  {
    icon: Sparkles,
    title: "A recommendation for every line",
    body: "Each line item gets an AI-suggested discount with a confidence level, not a single number for the whole deal.",
  },
  {
    icon: ListChecks,
    title: "Reasoning you can inspect",
    body: "Every recommendation breaks down into factors like baseline, tenure, deal size, and competitive pressure.",
  },
  {
    icon: ShieldCheck,
    title: "Policy checked before it ships",
    body: `The blended discount is measured against the ${POLICY_CEILING_PCT}% ceiling as you work, so nothing goes out that needs sign-off.`,
  },
];

export default function SignIn() {
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
          router.push("/");
        },
        onError: (error) => {
          toast.error("Sign in failed", { description: error.message });
        },
        onSettled: () => setPendingRole(null),
      },
    );
  };

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* Product story */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-primary px-8 py-10 text-primary-foreground lg:w-[52%] lg:px-16 lg:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full bg-primary-foreground/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-24 h-[420px] w-[420px] rounded-full bg-primary-foreground/[0.06] blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground text-sm font-semibold text-primary">
            D
          </span>
          <span className="text-sm font-semibold tracking-tight">Deal Discount Review</span>
        </div>

        <div className="relative my-12 max-w-xl lg:my-0">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
            Price every line item with confidence.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-primary-foreground/75">
            AI-recommended discounts with the reasoning behind them, checked against policy
            before the deal goes out.
          </p>

          <ul className="mt-10 space-y-6">
            {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10 text-primary-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-primary-foreground/70">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 max-w-sm rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.06] p-4 backdrop-blur">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/80">
                Blended discount
              </p>
              <p className="text-lg font-semibold tabular-nums">12.5%</p>
            </div>
            <div className="mt-2 [&_[role=meter]]:bg-primary-foreground/15 [&_p]:text-primary-foreground/85 [&_span]:text-primary-foreground/85">
              <PolicyGauge value={12.5} showHeadroom={false} />
            </div>
            <p className="mt-2 text-xs text-primary-foreground/70">
              2.5 pts of headroom. Closes without approval.
            </p>
          </div>
        </div>

        <p className="relative text-xs text-primary-foreground/75">
          Internal tool · Pricing &amp; Deal Desk
        </p>
      </section>

      {/* Role selection */}
      <section className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-[440px]">
          <div className="lg:hidden">
            <LogoMark size={40} />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight lg:mt-0">Sign in</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a role to continue. The two views are built for different jobs.
          </p>

          <div className="mt-8 space-y-3">
            {ROLE_CARDS.map(({ role, icon: Icon, description }) => {
              const isPending = loginMutation.isPending && pendingRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  disabled={loginMutation.isPending}
                  onClick={() => submit(role)}
                  className="surface-card pressable-card group flex w-full items-center gap-4 p-4 text-left hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      Continue as {ROLE_LABEL[role]}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {description}
                    </span>
                  </span>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            No password needed for these demo accounts. You can switch roles at any time from the
            account menu.
          </p>
        </div>
      </section>
    </main>
  );
}
