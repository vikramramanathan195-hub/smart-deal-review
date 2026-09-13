"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronRight,
  DollarSign,
  Percent,
  Search,
  X,
} from "lucide-react";
import { TopNav } from "@/components/app/top-nav";
import { AccountMenu } from "@/components/app/account-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/lib/session";
import { useDealsQuery } from "@/lib/queries";
import { currency, formatMoney, pct, policyStatus, TERM_LENGTH_LABEL } from "@/lib/deal-data";
import { regionInfo, toUsd } from "@/lib/fx-rates";
import { ApiError } from "@/lib/api";
import { useCountUp } from "@/lib/use-count-up";
import { NewDealDialog } from "@/components/app/new-deal-dialog";
import { PolicyGauge } from "@/components/app/policy-gauge";
import type { DealSummary } from "@/lib/api-types";

type SortKey = "name" | "value" | "discount";
const SORT_LABEL: Record<SortKey, string> = {
  name: "Name",
  value: "Total value",
  discount: "Blended discount",
};

function errorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : "Something went wrong";
}

export default function Home() {
  const { isSignedIn, role } = useSession();
  const router = useRouter();

  // Session lives only in memory (no persistence) — a refresh or a direct
  // visit loses it. Without this the deals query would stay disabled and
  // isPending forever instead of sending the user back to sign in.
  useEffect(() => {
    if (!isSignedIn) router.replace("/sign-in");
  }, [isSignedIn, router]);

  const dealsQuery = useDealsQuery();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const deals = useMemo(() => {
    const data = dealsQuery.data ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? data.filter(
          (d) => d.name.toLowerCase().includes(q) || d.customerName.toLowerCase().includes(q),
        )
      : data;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "value") return (toUsd(a.dealValueTotal, a.region) - toUsd(b.dealValueTotal, b.region)) * dir;
      return (a.blendedDiscountPct - b.blendedDiscountPct) * dir;
    });
  }, [dealsQuery.data, query, sortKey, sortDir]);

  const stats = useMemo(() => {
    const data = dealsQuery.data ?? [];
    if (data.length === 0) return null;
    const totalUsd = data.reduce((s, d) => s + toUsd(d.dealValueTotal, d.region), 0);
    const avgDiscount = data.reduce((s, d) => s + d.blendedDiscountPct, 0) / data.length;
    // "needs_approval" reflects the deal's blended discount vs. the 15%
    // ceiling and never flips back on its own — approvalState is the actual
    // record of whether a manager has already acted. A deal only belongs in
    // the queue while no decision has been recorded yet; once approved or
    // rejected, it's off the manager's plate (rejected goes back to the rep).
    const needsApproval = data.filter(
      (d) => d.status === "needs_approval" && d.approvalState == null,
    );
    return { totalUsd, avgDiscount, needsApproval };
  }, [dealsQuery.data]);

  const animatedTotalUsd = useCountUp(stats?.totalUsd ?? 0);
  const animatedAvgDiscount = useCountUp(stats?.avgDiscount ?? 0);

  if (!isSignedIn) {
    return <CenteredMessage>Redirecting to sign in…</CenteredMessage>;
  }

  return (
    <div className="min-h-screen">
      <TopNav right={<AccountMenu />} />

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-lg font-semibold tracking-tight">Your active deals</h1>
          {role === "sales_rep" && <NewDealDialog />}
        </div>

        {stats && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="surface-card flex items-center gap-3 p-4">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ai-softer text-ai">
                <DollarSign className="h-4 w-4" />
              </span>
              <div>
                <p className="label-caps">Total pipeline</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">
                  {currency(animatedTotalUsd)}
                </p>
              </div>
            </div>
            <div className="surface-card flex items-center gap-3 p-4">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ai-softer text-ai">
                <Percent className="h-4 w-4" />
              </span>
              <div>
                <p className="label-caps">Avg. blended discount</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">
                  {pct(animatedAvgDiscount)}
                </p>
              </div>
            </div>
            <div className="surface-card flex items-center gap-3 p-4">
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  stats.needsApproval.length > 0
                    ? "bg-danger-soft text-danger"
                    : "bg-success-soft text-success"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <p className="label-caps">Needs approval</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">
                  {stats.needsApproval.length}
                </p>
              </div>
            </div>
          </div>
        )}

        {role === "manager" && stats && stats.needsApproval.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-danger">
              Needs your approval
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {stats.needsApproval.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-sm font-semibold tracking-tight">All deals</h2>

          {!dealsQuery.isPending && !dealsQuery.isError && (dealsQuery.data.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search deals or customers…"
                  aria-label="Search deals by name or customer"
                  className="h-8 w-64 pl-8 pr-7 text-sm sm:w-72"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger aria-label="Sort deals by" className="h-8 w-[168px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SORT_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                type="button"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                aria-label={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
                title={sortDir === "asc" ? "Ascending" : "Descending"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {sortDir === "asc" ? (
                  <ArrowDownAZ className="h-4 w-4" />
                ) : (
                  <ArrowUpAZ className="h-4 w-4" />
                )}
              </button>
            </div>
          )}
        </div>

        {dealsQuery.isPending ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="surface-card h-44 animate-pulse" />
            ))}
          </div>
        ) : dealsQuery.isError ? (
          <p className="text-sm font-medium text-danger">
            Couldn&apos;t load deals — {errorMessage(dealsQuery.error)}
          </p>
        ) : deals.length === 0 ? (
          <div className="surface-card flex flex-col items-center gap-3 p-10 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search className="h-4 w-4" />
            </span>
            <p className="text-sm font-medium">No deals match &ldquo;{query}&rdquo;</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-sm font-medium text-ai hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {deals.length} of {dealsQuery.data.length} deal
              {dealsQuery.data.length === 1 ? "" : "s"}
              {dealsQuery.data.some((d) => policyStatus(d.blendedDiscountPct).status === "exceeds") && (
                <>
                  {" "}
                  ·{" "}
                  {
                    dealsQuery.data.filter(
                      (d) => policyStatus(d.blendedDiscountPct).status === "exceeds",
                    ).length
                  }{" "}
                  exceeding policy
                </>
              )}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </>
        )}

        <Link
          href="/health"
          className="surface-card flex items-center gap-3 p-4 text-sm font-medium transition-shadow hover:shadow-card-hover"
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Activity className="h-4 w-4" />
          </span>
          System Health
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </Link>
      </main>
    </div>
  );
}

function DealCard({ deal }: { deal: DealSummary }) {
  const policy = policyStatus(deal.blendedDiscountPct);
  // The policy badge is a fact about the numbers (blended % vs. the 15%
  // ceiling) and never changes once a deal exceeds it — a manager's decision
  // doesn't retroactively bring the discount back in range. So a resolved
  // deal gets its own badge layered on top, rather than the policy badge
  // silently disappearing or staying red after it's been handled.
  const badge =
    policy.status === "within"
      ? { label: "Within Range", cls: "bg-success-soft text-success" }
      : deal.approvalState === "approved"
        ? { label: "Approved", cls: "bg-success-soft text-success" }
        : deal.approvalState === "rejected"
          ? { label: "Changes Requested", cls: "bg-warning-soft text-warning" }
          : { label: "Exceeds Policy", cls: "bg-danger-soft text-danger" };

  return (
    <Link
      href={`/deals?deal=${deal.id}`}
      className="surface-card group flex flex-col p-5 transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-snug">{deal.name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{deal.customerName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {badge.label}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-6">
        <div>
          <p className="label-caps">Total value</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatMoney(deal.dealValueTotal, deal.region)}
          </p>
          {deal.region !== "north_america" && (
            <p className="text-xs tabular-nums text-muted-foreground">
              ≈ {currency(toUsd(deal.dealValueTotal, deal.region))} USD
            </p>
          )}
        </div>
        <div className="min-w-[160px]">
          <p className="label-caps">Blended discount</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{pct(deal.blendedDiscountPct)}</p>
          <PolicyGauge value={deal.blendedDiscountPct} size="sm" className="mt-2 max-w-[160px]" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>{regionInfo(deal.region).label}</span>
        <span aria-hidden="true">·</span>
        <span>{TERM_LENGTH_LABEL[deal.termLength]}</span>
        <span aria-hidden="true">·</span>
        <span>
          {deal.lineItemCount} line{deal.lineItemCount === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {deal.productCategories.map((category) => (
            <span
              key={category}
              className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"
            >
              {category}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
