"use client";

import { Sparkles, AlertTriangle, Loader2, Check, Clock, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { currency, pct } from "@/lib/deal-data";
import type {
  Confidence,
  Customer,
  DiscountHistoryEntry,
  DiscountRecommendation,
  Factor,
  LineItem,
} from "@/lib/api-types";

// A proposal within this many points of the AI's recommendation auto-applies;
// beyond it, the backend locks the line for manager approval. Mirrors
// AUTO_APPROVE_BAND_PCT in backend/app/store.py — shown here only as a hint.
const AUTO_APPROVE_BAND_PCT = 3;

function ConfidenceBadge({ level }: { level: Confidence }) {
  const map = {
    high: { cls: "bg-success-soft text-success", dot: "bg-success", text: "High confidence" },
    medium: {
      cls: "bg-warning-soft text-warning-foreground",
      dot: "bg-warning",
      text: "Medium confidence",
    },
    low: { cls: "bg-danger-soft text-danger", dot: "bg-danger", text: "Low confidence" },
  }[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${map.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.text}
    </span>
  );
}

function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-foreground">
      <Clock className="h-3 w-3" />
      Pending manager approval
    </span>
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
  const suffix = level === "low" ? " — well outside the model's typical range for this line." : ".";
  return {
    level,
    note: `${absDeviation.toFixed(1)} pts ${direction} the AI recommendation${suffix}`,
  };
}

function formatWhen(iso: string): string {
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

const HISTORY_ACTION_LABEL: Record<string, string> = {
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
  return <div className="rounded-xl border border-border bg-card p-5 shadow-card">{children}</div>;
}

function FactorRow({ factor, max }: { factor: Factor; max: number }) {
  const negative = !factor.positive;
  const width = Math.max(4, (Math.abs(factor.contributionPct) / max) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-foreground">{factor.name}</span>
        <span
          className={`text-[13px] font-semibold tabular-nums ${negative ? "text-danger" : "text-success"}`}
        >
          {negative ? "−" : factor.name.startsWith("Baseline") ? "" : "+"}
          {Math.abs(factor.contributionPct).toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${negative ? "bg-danger" : "bg-ai"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/60 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
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
    <div className="relative overflow-hidden rounded-xl bg-ai-softer p-5 pl-6">
      <span className="absolute inset-y-0 left-0 w-1 bg-ai" aria-hidden="true" />
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ai text-ai-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h4 className="text-sm font-semibold text-foreground">AI Discount Recommendation</h4>
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
  readOnly,
  isDeciding,
  isResolvingApproval,
  onPropose,
  onAccept,
  onResolveApproval,
}: {
  lineItem: LineItem;
  recommendation: DiscountRecommendation;
  customer: Customer;
  discountHistory: DiscountHistoryEntry[];
  readOnly: boolean;
  isDeciding: boolean;
  isResolvingApproval: boolean;
  onPropose: (discountPct: number, reason: string) => Promise<void>;
  onAccept: () => Promise<void>;
  onResolveApproval: (decision: "approved" | "rejected") => Promise<void>;
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
  const appliedNetValue = lineItem.dealValue * (1 - applied / 100);
  const pendingNetValue =
    lineItem.pendingDiscountPct !== null
      ? lineItem.dealValue * (1 - lineItem.pendingDiscountPct / 100)
      : null;

  const callout =
    recommendation.recommendedPct - customer.avgDiscountPct > 0.5
      ? `${(recommendation.recommendedPct - customer.avgDiscountPct).toFixed(1)} pts above ${customer.name}'s historical average.`
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
          <p className="mt-2 text-[13px] tabular-nums text-muted-foreground">
            Net:{" "}
            {currency(
              isPending && pendingNetValue !== null
                ? pendingNetValue
                : decided
                  ? appliedNetValue
                  : recommendation.netValue,
            )}{" "}
            on {currency(lineItem.dealValue)}
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
          {appliedFeedback && (
            <div className="mt-2 space-y-0.5">
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
              AI suggested {pct(recommendation.recommendedPct)} — this proposal is{" "}
              {Math.abs((lineItem.pendingDiscountPct ?? 0) - recommendation.recommendedPct).toFixed(
                1,
              )}{" "}
              pts away, outside the {AUTO_APPROVE_BAND_PCT}-pt auto-approve band.
            </p>
          )}

          <div className="my-5 h-px bg-border" />

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
              <p className="mt-2 text-[13px] text-muted-foreground">
                Read-only — reps own line-level decisions.
              </p>
            </>
          ) : (
            <>
              <p className="label-caps">Your decision</p>
              {isPending ? (
                <p className="mt-2 text-[13px] text-muted-foreground">
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
                      <div className="relative mt-1.5">
                        <Input
                          id={`discount-${lineItem.id}`}
                          className="pr-7 tabular-nums"
                          inputMode="decimal"
                          autoFocus
                          aria-invalid={!!discountError}
                          value={draft}
                          placeholder={String(recommendation.recommendedPct)}
                          onChange={(e) => handleDraftChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && canSubmit) void handleSubmit();
                          }}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                      {discountError && (
                        <p className="mt-1.5 text-xs font-medium text-danger">{discountError}</p>
                      )}

                      <div className="mt-3">
                        <label className="label-caps" htmlFor={`reason-${lineItem.id}`}>
                          Reason for this discount
                        </label>
                        <Input
                          id={`reason-${lineItem.id}`}
                          className="mt-1.5"
                          value={reasonDraft}
                          placeholder="Why are you proposing this discount?"
                          onChange={(e) => setReasonDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && canSubmit) void handleSubmit();
                          }}
                        />
                        {reasonMissing && (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            A reason is required for every proposed discount.
                          </p>
                        )}
                      </div>

                      {draftNumber !== null && !discountError && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {willAutoApply ? (
                            <>
                              Within {AUTO_APPROVE_BAND_PCT} pts of the recommendation — applies
                              immediately.
                            </>
                          ) : (
                            <>
                              More than {AUTO_APPROVE_BAND_PCT} pts from the recommendation — will
                              require manager approval.
                            </>
                          )}
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
              className={`mt-3 rounded-lg p-2.5 transition-colors ${
                justSaved ? "bg-success-soft" : "bg-transparent"
              }`}
            >
              <p className="flex items-center gap-1.5 text-xs font-medium text-ai">
                {justSaved && <Check className="h-3.5 w-3.5 text-success" />}
                <span>
                  Applied {pct(applied)} · {lineItem.decision}
                  {lineItem.decision === "overridden" && lineItem.overrideReason
                    ? ` — ${lineItem.overrideReason}`
                    : ""}
                </span>
              </p>
              {justSaved && <p className="mt-1 text-xs font-semibold text-success">Saved</p>}
            </div>
          )}
          {isPending && (
            <div className="mt-3 rounded-lg border border-warning/40 bg-warning-soft p-2.5">
              <p className="flex items-center gap-1.5 text-xs leading-relaxed text-warning-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Proposed {pct(lineItem.pendingDiscountPct ?? 0)} · pending manager approval —
                  reason: {lineItem.overrideReason}
                </span>
              </p>
              {lineItem.decidedBy && (
                <p className="mt-1 text-xs text-warning-foreground/80">
                  Proposed by <span className="font-semibold">{lineItem.decidedBy}</span>
                </p>
              )}
            </div>
          )}
          <DiscountHistoryLog entries={lineItem.history} />
        </PanelCard>

        {/* Column 2 */}
        <PanelCard>
          <h5 className="text-sm font-semibold">Why this number</h5>
          <p className="mt-1 text-xs text-muted-foreground">
            Each factor below adjusts the baseline discount.
          </p>
          <div className="mt-4 space-y-3.5">
            {recommendation.factors.map((f) => (
              <FactorRow key={f.name} factor={f} max={maxFactor} />
            ))}
          </div>
          <div className="my-4 h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">Final recommendation</span>
            <span className="text-base font-semibold tabular-nums">
              {pct(Math.round(total * 10) / 10)}
            </span>
          </div>
        </PanelCard>

        {/* Column 3 — deal-level customer context, shared across every line item */}
        <PanelCard>
          <h5 className="text-sm font-semibold">Customer context</h5>
          <p className="mt-1 text-xs text-muted-foreground">
            {customer.name} · Partner since {customer.partnerSince}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatBox label="Lifetime" value={customer.lifetimeValue} />
            <StatBox label="Renewal" value={pct(customer.renewalRatePct)} />
            <StatBox label="Avg disc." value={pct(customer.avgDiscountPct)} />
          </div>

          <p className="label-caps mt-5">Discount history</p>
          <div className="mt-2.5 space-y-2.5">
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

          {callout && (
            <div className="mt-5 flex gap-2.5 rounded-lg bg-warning-soft p-3">
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-primary-foreground">
                !
              </span>
              <p className="text-xs leading-relaxed text-warning-foreground">{callout}</p>
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
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-warning" />
        Pick a product category and enter a deal value to get a recommendation.
      </div>
    </PanelShell>
  );
}
