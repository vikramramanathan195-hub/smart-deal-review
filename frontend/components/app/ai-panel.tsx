"use client";

import { Sparkles, AlertTriangle, Loader2, Check, Clock, ChevronDown, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InitialsAvatar } from "@/components/app/initials-avatar";
import { formatMoney, pct, POLICY_CEILING_PCT } from "@/lib/deal-data";
import type {
  Confidence,
  Customer,
  DiscountHistoryEntry,
  DiscountRecommendation,
  Factor,
  LineItem,
  Region,
} from "@/lib/api-types";

// A proposal within this many points of the AI's recommendation auto-applies;
// beyond it, the backend locks the line for manager approval. Mirrors
// AUTO_APPROVE_BAND_PCT in backend/app/store.py — shown here only as a hint.
const AUTO_APPROVE_BAND_PCT = 3;

function ConfidenceBadge({ level }: { level: Confidence }) {
  const map = {
    high: { cls: "bg-success-soft text-success", dot: "bg-success", text: "High confidence" },
    medium: {
      cls: "bg-warning-soft text-warning",
      dot: "bg-warning",
      text: "Medium confidence",
    },
    low: { cls: "bg-danger-soft text-danger", dot: "bg-danger", text: "Low confidence" },
  }[level];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${map.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.text}
    </span>
  );
}

/** What each confidence level should mean for the rep's next move. Kept
 * about the model's precedent rather than this customer's numbers, since the
 * seeded confidence is per line and a data-derived claim could contradict it. */
const CONFIDENCE_NOTE: Record<Confidence, string> = {
  high: "Strong precedent for this deal profile. Safe to accept as-is.",
  medium:
    "Some precedent, but this could reasonably land a point or two either way. Worth a glance at the factors.",
  low: "Little precedent for this profile. Treat it as a starting point and check the factors before accepting.",
};

/** One-line read of the win/loss history so the list below it has a takeaway. */
function historyInsight(entries: DiscountHistoryEntry[]): string | null {
  if (entries.length === 0) return null;
  const wins = entries.filter((h) => h.outcome === "won").map((h) => h.discountPct);
  const losses = entries.filter((h) => h.outcome === "lost").map((h) => h.discountPct);
  const parts: string[] = [];
  if (wins.length > 0) {
    const lo = Math.min(...wins);
    const hi = Math.max(...wins);
    const range = lo === hi ? `at ${lo.toFixed(1)}%` : `between ${lo.toFixed(1)}% and ${hi.toFixed(1)}%`;
    parts.push(`Won ${wins.length} of ${entries.length} past deals ${range}.`);
  } else {
    parts.push(`Lost all ${entries.length} past deals.`);
  }
  if (wins.length > 0 && losses.length > 0) {
    const times = losses.length === 1 ? "once" : `${losses.length} times`;
    parts.push(`Lost ${times} at ${losses.map((l) => `${l.toFixed(1)}%`).join(", ")}.`);
  }
  return parts.join(" ");
}

function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
      <Clock className="h-3 w-3" />
      Pending manager approval
    </span>
  );
}

/** A real Claude call (via LangChain), on demand — not run automatically,
 * since it costs real tokens and the deterministic factors above are
 * already the thing a rep decides against. This is a narrated add-on. */
function AiTakeButton({ onGetAiTake }: { onGetAiTake: () => Promise<string> }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [text, setText] = useState<string | null>(null);

  const run = async () => {
    setState("loading");
    try {
      const result = await onGetAiTake();
      setText(result);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  if (text) {
    return (
      <div className="mt-3 rounded-lg border border-ai/25 bg-ai-softer p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ai">
          <MessageSquareText className="h-3 w-3" />
          AI take
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-foreground">{text}</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void run()}
        disabled={state === "loading"}
        className="pressable inline-flex items-center gap-1.5 rounded-md border border-dashed border-ai/40 px-2.5 py-1.5 text-xs font-medium text-ai hover:bg-ai-softer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MessageSquareText className="h-3.5 w-3.5" />
        )}
        {state === "loading" ? "Thinking…" : "Get AI take"}
      </button>
      {state === "error" && (
        <p className="mt-1.5 text-xs text-danger">Couldn&apos;t reach the model. Try again.</p>
      )}
    </div>
  );
}

/** Confidence read for whatever discount is actually applied (accepted,
 * adjusted, or an approved proposal), based on how far it strayed from the
 * AI's own recommendation — not a new AI call, just a plain-language gauge
 * of how far outside the model's guidance the rep's number sits. */
function appliedConfidence(
  applied: number,
  recommendedPct: number,
): { level: Confidence; note: string } {
  const deviation = applied - recommendedPct;
  const absDeviation = Math.abs(deviation);
  const level: Confidence = absDeviation <= 1 ? "high" : absDeviation <= 3 ? "medium" : "low";

  if (absDeviation < 0.05) {
    return { level, note: "Matches the AI recommendation exactly." };
  }
  const direction = deviation > 0 ? "above" : "below";
  const suffix = level === "low" ? " (well outside the model's typical range for this line)." : ".";
  return {
    level,
    note: `${absDeviation.toFixed(1)} pts ${direction} the AI recommendation${suffix}`,
  };
}

export function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const HISTORY_ACTION_LABEL: Record<string, string> = {
  accepted: "Accepted AI recommendation",
  proposed_auto_applied: "Proposed (auto-applied)",
  proposed_pending_approval: "Proposed (sent for approval)",
  approved: "Manager approved",
  rejected: "Manager rejected",
};

function DiscountHistoryLog({ entries }: { entries: LineItem["history"] }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        History ({entries.length})
      </button>
      {open && (
        <ul className="mt-2 space-y-2 border-l border-border pl-3">
          {[...entries].reverse().map((h, i) => (
            <li key={i} className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                {HISTORY_ACTION_LABEL[h.action] ?? h.action}
              </span>{" "}
              <span className="tabular-nums">
                {h.previousPct === null ? "—" : `${h.previousPct}%`} →{" "}
                {h.newPct === null ? "—" : `${h.newPct}%`}
              </span>
              <br />
              {h.by} · {formatWhen(h.at)}
              {h.reason ? <> · &quot;{h.reason}&quot;</> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PanelCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-6 shadow-card">{children}</div>;
}

/** Plain-language meaning of each factor, keyed by how its name starts so
 * the same explanation covers "Customer tenure (4 yrs)" and "(7 yrs)".
 * Thresholds quoted here mirror generate_recommendation in the backend. */
const FACTOR_EXPLANATIONS: [RegExp, string][] = [
  [/^Baseline/, "The starting discount for this customer segment, before anything specific to this deal is taken into account."],
  [/^Customer tenure/, "Longer relationships earn a little more room. Scales with how many years the customer has been a partner."],
  [/^Deal size tier/, "Bigger line values unlock a higher discount tier. The tiers step up at 50k, 100k, and 250k."],
  [/^Regional competitive pressure/, "How aggressively competitors price in this customer's region. More pressure means more room is needed to win."],
  [/^Competitive displacement/, "Extra room when the deal replaces an incumbent vendor, since switching costs work against us."],
  [/^Multi-year term/, "A longer commitment trades a deeper discount now for revenue that is locked in."],
  [/^Multi-region rollout/, "Delivering across several regions at once adds coordination risk, which the price reflects."],
  [/^Renewal loyalty/, "A credit for renewing rather than putting the business back out to bid."],
  [/^Margin floor/, "Pulls the total back so the line stays above the minimum acceptable margin. Always negative."],
];

function explainFactor(name: string): string {
  return (
    FACTOR_EXPLANATIONS.find(([pattern]) => pattern.test(name))?.[1] ??
    "One of the inputs the model weighs when pricing this line."
  );
}

function FactorRow({ factor, max }: { factor: Factor; max: number }) {
  const negative = !factor.positive;
  const width = Math.max(4, (Math.abs(factor.contributionPct) / max) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="pressable rounded-sm text-left text-sm text-foreground underline decoration-border decoration-dotted underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {factor.name}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label={`About ${factor.name}`}
            className="w-72 p-4 text-sm leading-relaxed"
          >
            {explainFactor(factor.name)}
          </PopoverContent>
        </Popover>
        <span
          className={`text-sm font-semibold tabular-nums ${negative ? "text-danger" : "text-success"}`}
        >
          {negative ? "−" : factor.name.startsWith("Baseline") ? "" : "+"}
          {Math.abs(factor.contributionPct).toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${negative ? "ml-auto bg-danger" : "bg-ai"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/60 px-3 py-3">
      <p className="label-caps">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AiPanelSkeleton() {
  return (
    <PanelShell>
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <PanelCard key={i}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-4 h-10 w-24" />
            <Skeleton className="mt-3 h-3 w-40" />
            <Skeleton className="mt-4 h-8 w-full" />
            <Skeleton className="mt-2 h-8 w-full" />
            <Skeleton className="mt-2 h-8 w-2/3" />
          </PanelCard>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Generating recommendation…</p>
    </PanelShell>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-ai-softer p-6 pl-6">
      <span className="absolute inset-y-0 left-0 w-1 bg-ai" aria-hidden="true" />
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ai text-ai-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold text-foreground">AI Discount Recommendation</h3>
      </div>
      {children}
    </div>
  );
}

export function AiPanel({
  lineItem,
  recommendation,
  customer,
  discountHistory,
  region,
  readOnly,
  isDeciding,
  isResolvingApproval,
  isUndoingDecision,
  onPropose,
  onAccept,
  onResolveApproval,
  onUndoDecision,
  previewBlended,
  onGetAiTake,
}: {
  lineItem: LineItem;
  recommendation: DiscountRecommendation;
  customer: Customer;
  discountHistory: DiscountHistoryEntry[];
  region: Region;
  readOnly: boolean;
  isDeciding: boolean;
  isResolvingApproval: boolean;
  isUndoingDecision: boolean;
  onPropose: (discountPct: number, reason: string) => Promise<void>;
  onAccept: () => Promise<void>;
  onResolveApproval: (decision: "approved" | "rejected") => Promise<void>;
  onUndoDecision: () => Promise<void>;
  /** Deal-level blended discount if this line were set to the given %, so a
   * proposal can show its effect on the whole deal before it's submitted. */
  previewBlended?: (pct: number) => number;
  /** Real Claude call (via LangChain, backend/app/ai_take.py) that narrates
   * this recommendation in plain speech. Optional so the panel still works
   * standalone if a caller doesn't wire it up. */
  onGetAiTake?: () => Promise<string>;
}) {
  const isPending = lineItem.lineApprovalState === "pending_approval";
  const applied = lineItem.appliedDiscountPct ?? recommendation.recommendedPct;
  const maxFactor = Math.max(...recommendation.factors.map((f) => Math.abs(f.contributionPct)));
  const total = recommendation.factors.reduce((s, f) => s + f.contributionPct, 0);
  const maxHistory = Math.max(1, ...discountHistory.map((h) => h.discountPct));
  const decided = lineItem.decision !== "pending" && !isPending;

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const openForm = () => {
    setDraft(String(applied));
    setReasonDraft("");
    setIsOpen(true);
  };
  const closeForm = () => {
    setIsOpen(false);
    setDraft("");
    setReasonDraft("");
  };

  const draftNumber = draft === "" || draft === "-" ? null : Number(draft);
  const discountError =
    draftNumber === null
      ? null
      : draftNumber > 100
        ? "Discount cannot exceed 100%"
        : draftNumber < 0
          ? "Discount cannot be negative"
          : null;
  const reasonMissing = reasonDraft.trim() === "";
  const canSubmit = draftNumber !== null && !discountError && !reasonMissing && !isDeciding;
  const willAutoApply =
    draftNumber !== null &&
    Math.abs(draftNumber - recommendation.recommendedPct) <= AUTO_APPROVE_BAND_PCT;

  const handleDraftChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.-]/g, "");
    const normalized = cleaned.startsWith("-") ? `-${cleaned.slice(1).replace(/-/g, "")}` : cleaned;
    setDraft(normalized);
  };

  const handleSubmit = async () => {
    if (!canSubmit || draftNumber === null) return;
    try {
      await onPropose(draftNumber, reasonDraft.trim());
      closeForm();
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2600);
    } catch {
      // Leave the form open so the rep can correct and retry; the parent toasts.
    }
  };

  const appliedFeedback = decided
    ? appliedConfidence(applied, recommendation.recommendedPct)
    : null;
  // Net for whatever is actually applied — the API's netValue tracks the
  // recommendation, which no longer matches once a rep changes the number.
  const shownPct = isPending
    ? (lineItem.pendingDiscountPct ?? 0)
    : decided
      ? applied
      : recommendation.recommendedPct;
  const shownNet = lineItem.dealValue * (1 - shownPct / 100);

  const insight = historyInsight(discountHistory);
  // No history means avgDiscountPct is a placeholder zero, so "N pts above
  // average" would be nonsense for a brand-new customer.
  const callout =
    discountHistory.length > 0 && recommendation.recommendedPct - customer.avgDiscountPct > 0.5
      ? `${(recommendation.recommendedPct - customer.avgDiscountPct).toFixed(1)} pts above this customer's ${pct(customer.avgDiscountPct)} average.`
      : null;

  const proposalPreview =
    previewBlended && draftNumber !== null && !discountError
      ? { current: previewBlended(applied), next: previewBlended(draftNumber) }
      : null;

  return (
    <PanelShell>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Column 1 */}
        <PanelCard>
          <p className="label-caps">
            {isPending
              ? "Proposed discount"
              : decided
                ? "Applied discount"
                : "Recommended discount"}
          </p>
          <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
            {pct(
              isPending
                ? (lineItem.pendingDiscountPct ?? 0)
                : decided
                  ? applied
                  : recommendation.recommendedPct,
            )}
          </p>
          <p className="mt-2 text-sm tabular-nums text-muted-foreground">
            Customer pays {formatMoney(shownNet, region)}
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            saves {formatMoney(lineItem.dealValue - shownNet, region)}
          </p>
          {/* Exactly one status badge: pending, or the AI's own confidence in
              its recommendation. Always the model's confidence — never
              recomputed from how closely the applied value matches it, since
              that read differently (e.g. "high" just because Accept always
              matches exactly) and made it look like accepting changed the
              model's mind. */}
          <div className="mt-3">
            {isPending ? <PendingBadge /> : <ConfidenceBadge level={recommendation.confidence} />}
          </div>
          {!isPending && !decided && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {CONFIDENCE_NOTE[recommendation.confidence]}
            </p>
          )}
          {onGetAiTake && <AiTakeButton onGetAiTake={onGetAiTake} />}
          {appliedFeedback && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground">
                AI suggested {pct(recommendation.recommendedPct)}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {appliedFeedback.note}
              </p>
            </div>
          )}
          {isPending && (
            <p className="mt-2 text-xs text-muted-foreground">
              AI suggested {pct(recommendation.recommendedPct)}. This proposal is{" "}
              {Math.abs((lineItem.pendingDiscountPct ?? 0) - recommendation.recommendedPct).toFixed(
                1,
              )}{" "}
              pts away, outside the {AUTO_APPROVE_BAND_PCT}-pt auto-approve band.
            </p>
          )}

          <div className="my-6 h-px bg-border" />

          {/* Manager view on a pending line: approve/reject controls. */}
          {readOnly && isPending ? (
            <>
              <p className="label-caps">Manager decision</p>
              <div className="mt-3 space-y-2">
                <Button
                  className="w-full"
                  disabled={isResolvingApproval}
                  onClick={() => void onResolveApproval("approved").catch(() => {})}
                >
                  {isResolvingApproval ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Approve {pct(lineItem.pendingDiscountPct ?? 0)}</span>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isResolvingApproval}
                  onClick={() => void onResolveApproval("rejected").catch(() => {})}
                >
                  Reject proposal
                </Button>
              </div>
            </>
          ) : readOnly ? (
            <>
              <p className="label-caps">Your decision</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Read-only. Reps own line-level decisions.
              </p>
            </>
          ) : (
            <>
              <p className="label-caps">Your decision</p>
              {isPending ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Locked while this proposal awaits manager approval.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  <Button
                    className="w-full"
                    disabled={isDeciding}
                    onClick={() => {
                      closeForm();
                      void onAccept().catch(() => {});
                    }}
                  >
                    {isDeciding && !isOpen ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : lineItem.decision === "accepted" ? (
                      <span>Accepted {pct(applied)}</span>
                    ) : (
                      <span>Accept {pct(recommendation.recommendedPct)}</span>
                    )}
                  </Button>
                  <Button
                    variant={isOpen ? "secondary" : "outline"}
                    className="w-full"
                    disabled={isDeciding}
                    onClick={() => (isOpen ? closeForm() : openForm())}
                  >
                    Propose Discount
                  </Button>

                  {isOpen && (
                    <div className="rounded-lg border border-border bg-secondary/50 p-3">
                      <label className="label-caps" htmlFor={`discount-${lineItem.id}`}>
                        Proposed discount %
                      </label>
                      <div className="relative mt-2">
                        <Input
                          id={`discount-${lineItem.id}`}
                          className="pr-8 tabular-nums"
                          inputMode="decimal"
                          autoFocus
                          aria-invalid={!!discountError}
                          value={draft}
                          placeholder={String(recommendation.recommendedPct)}
                          onChange={(e) => handleDraftChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && canSubmit) void handleSubmit();
                            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                            e.preventDefault();
                            const step = (e.shiftKey ? 1 : 0.5) * (e.key === "ArrowUp" ? 1 : -1);
                            const base = draftNumber ?? recommendation.recommendedPct;
                            const next = Math.min(100, Math.max(0, Math.round((base + step) * 10) / 10));
                            setDraft(String(next));
                          }}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                      {discountError && (
                        <p className="mt-2 text-xs font-medium text-danger">{discountError}</p>
                      )}

                      <div className="mt-3">
                        <label className="label-caps" htmlFor={`reason-${lineItem.id}`}>
                          Reason for this discount
                        </label>
                        <Input
                          id={`reason-${lineItem.id}`}
                          className="mt-2"
                          value={reasonDraft}
                          placeholder="Why are you proposing this discount?"
                          onChange={(e) => setReasonDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && canSubmit) void handleSubmit();
                          }}
                        />
                        {reasonMissing && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            A reason is required for every proposed discount.
                          </p>
                        )}
                      </div>

                      {draftNumber !== null && !discountError && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {willAutoApply ? (
                            <>
                              Within {AUTO_APPROVE_BAND_PCT} pts of the recommendation, so it applies
                              immediately.
                            </>
                          ) : (
                            <>
                              More than {AUTO_APPROVE_BAND_PCT} pts from the recommendation, so it will
                              require manager approval.
                            </>
                          )}
                        </p>
                      )}
                      {proposalPreview && (
                        <p
                          className={`mt-2 text-xs font-medium ${
                            proposalPreview.next > POLICY_CEILING_PCT ? "text-danger" : "text-success"
                          }`}
                        >
                          Deal blended discount {pct(proposalPreview.current)} →{" "}
                          {pct(proposalPreview.next)}
                          {proposalPreview.next > POLICY_CEILING_PCT
                            ? `, which would put the deal over the ${POLICY_CEILING_PCT}% ceiling.`
                            : `, still within the ${POLICY_CEILING_PCT}% ceiling.`}
                        </p>
                      )}

                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          className="flex-1"
                          disabled={!canSubmit}
                          onClick={() => void handleSubmit()}
                        >
                          {isDeciding ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <span>
                              Submit
                              {draftNumber !== null && !discountError ? ` ${draftNumber}%` : ""}
                            </span>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isDeciding}
                          onClick={closeForm}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Summary state once a decision is saved. */}
          {decided && (
            <div
              className={`mt-3 rounded-lg p-3 transition-colors ${
                justSaved ? "bg-success-soft" : "bg-transparent"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-medium text-foreground">
                  {justSaved && <Check className="h-3.5 w-3.5 text-success" />}
                  <span>
                    Applied {pct(applied)} · {lineItem.decision}
                    {lineItem.decision === "overridden" && lineItem.overrideReason
                      ? ` (${lineItem.overrideReason})`
                      : ""}
                  </span>
                </p>
                <button
                  type="button"
                  disabled={isUndoingDecision}
                  onClick={() => void onUndoDecision().catch(() => {})}
                  className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUndoingDecision ? "Undoing…" : "Undo"}
                </button>
              </div>
              {justSaved && <p className="mt-1 text-xs font-semibold text-success">Saved</p>}
            </div>
          )}
          {isPending && (
            <div className="mt-3 rounded-lg border border-warning/40 bg-warning-soft p-3">
              <p className="flex items-center gap-2 text-xs leading-relaxed text-warning">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Proposed {pct(lineItem.pendingDiscountPct ?? 0)} · pending manager approval
                  (reason: {lineItem.overrideReason})
                </span>
              </p>
              {lineItem.decidedBy && (
                <p className="mt-1 text-xs text-warning">
                  Proposed by <span className="font-semibold">{lineItem.decidedBy}</span>
                </p>
              )}
              {!readOnly && (
                <button
                  type="button"
                  disabled={isUndoingDecision}
                  onClick={() => void onUndoDecision().catch(() => {})}
                  className="mt-2 text-xs font-medium text-warning underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUndoingDecision ? "Retracting…" : "Retract proposal"}
                </button>
              )}
            </div>
          )}
          <DiscountHistoryLog entries={lineItem.history} />
        </PanelCard>

        {/* Column 2 */}
        <PanelCard>
          <h4 className="text-sm font-semibold">Why this number</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Each factor below adjusts the baseline discount.
          </p>
          <div className="mt-4 space-y-4">
            {recommendation.factors.map((f) => (
              <FactorRow key={f.name} factor={f} max={maxFactor} />
            ))}
          </div>
          <div className="my-4 h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Final recommendation</span>
            <span className="text-base font-semibold tabular-nums">
              {pct(Math.round(total * 10) / 10)}
            </span>
          </div>
        </PanelCard>

        {/* Column 3 — deal-level customer context, shared across every line item */}
        <PanelCard>
          <div className="flex items-center gap-3">
            <InitialsAvatar name={customer.name} size="sm" />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold">Customer context</h4>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {customer.name} · Partner since {customer.partnerSince}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatBox label="Lifetime" value={customer.lifetimeValue} />
            <StatBox label="Renewal" value={pct(customer.renewalRatePct)} />
            <StatBox label="Avg disc." value={pct(customer.avgDiscountPct)} />
          </div>

          <p className="label-caps mt-6">Discount history</p>
          {discountHistory.length === 0 && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              No past deals with this customer yet, so there is no history to compare against.
            </p>
          )}
          <div className="mt-3 space-y-3">
            {discountHistory.map((h) => (
              <div key={h.date} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{h.date}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${h.outcome === "won" ? "bg-success" : "bg-danger"}`}
                    style={{ width: `${(h.discountPct / maxHistory) * 100}%` }}
                  />
                </div>
                <span className="w-11 shrink-0 text-right text-xs font-semibold tabular-nums">
                  {h.discountPct.toFixed(1)}%
                </span>
                <span
                  className={`w-8 shrink-0 text-right text-xs font-semibold capitalize ${h.outcome === "won" ? "text-success" : "text-danger"}`}
                >
                  {h.outcome}
                </span>
              </div>
            ))}
          </div>
          {insight && (
            <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-xs font-medium leading-relaxed">
              {insight}
            </p>
          )}

          {callout && (
            <div className="mt-3 flex gap-3 rounded-lg bg-warning-soft p-3">
              <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-primary-foreground">
                !
              </span>
              <p className="text-xs leading-relaxed text-warning">{callout}</p>
            </div>
          )}
        </PanelCard>
      </div>
    </PanelShell>
  );
}

export function AiPanelEmpty() {
  return (
    <PanelShell>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-warning" />
        Pick a product category and enter a deal value to get a recommendation.
      </div>
    </PanelShell>
  );
}
