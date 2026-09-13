"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDown,
  Check,
  ChevronDown,
  Pencil,
  Plus,
  PackageOpen,
  Loader2,
} from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProgressSegments } from "@/components/app/progress-segments";
import { TopNav } from "@/components/app/top-nav";
import { AccountMenu } from "@/components/app/account-menu";
import { LineItemCard } from "@/components/app/line-item-card";
import { CategoryMultiSelect } from "@/components/app/category-multiselect";
import { SaveStateIndicator, type SaveState } from "@/components/app/save-state";
import { PolicyGauge } from "@/components/app/policy-gauge";
import { AiPanelSkeleton, HISTORY_ACTION_LABEL, formatWhen } from "@/components/app/ai-panel";
import { useSession } from "@/lib/session";
import {
  currency,
  formatMoney,
  pct,
  policyStatus,
  POLICY_CEILING_PCT,
  PRODUCT_CATEGORIES,
  TERM_LENGTH_LABEL,
  TERM_LENGTHS,
} from "@/lib/deal-data";
import { formatFxAsOf, REGIONS, toUsd } from "@/lib/fx-rates";
import type { LineItemDetail, ProductCategory, Region, TermLength } from "@/lib/api-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddLineItemMutation,
  useApprovalMutation,
  useDealQuery,
  useDealsQuery,
  useDecisionMutation,
  useLineItemApprovalMutation,
  useUndoLineItemDecisionMutation,
  useRemoveLineItemMutation,
  useUndoApprovalMutation,
  useUpdateDealMutation,
  useUpdateLineItemMutation,
} from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { useCountUp } from "@/lib/use-count-up";

function errorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : "Something went wrong";
}

/** Deterministic default for a newly added line, mirroring the old mock heuristic. */
function nextLineItemDefaults(existingCount: number): {
  productCategory: ProductCategory;
  dealValue: number;
} {
  const productCategory =
    PRODUCT_CATEGORIES[existingCount % PRODUCT_CATEGORIES.length] ?? "Compute";
  const dealValue = 60000 + ((existingCount * 27500) % 120000);
  return { productCategory, dealValue };
}

export default function Deals() {
  return (
    <Suspense fallback={<CenteredMessage>Loading deals…</CenteredMessage>}>
      <DealsContent />
    </Suspense>
  );
}

function DealsContent() {
  const { role, isSignedIn } = useSession();
  const readOnly = role === "manager";
  const router = useRouter();
  const searchParams = useSearchParams();
  // Deep link from the home dashboard, e.g. /deals?deal=cerulean.
  const dealParam = searchParams.get("deal");

  // Session lives only in memory (no persistence) — a refresh or a direct
  // visit to /deals loses it. Without this, useDealsQuery's `enabled:
  // isSignedIn` leaves the query permanently in isPending with nothing to
  // ever resolve it, so the page would show "Loading deals…" forever
  // instead of sending the user back to sign in.
  useEffect(() => {
    if (!isSignedIn) router.replace("/sign-in");
  }, [isSignedIn, router]);

  const dealsQuery = useDealsQuery();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  // Soft-delete: a removed line item hides immediately and the actual
  // DELETE is deferred behind an undo window, so leaving the page (or
  // hitting Undo) within the window keeps the backend untouched.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [regionSaveState, setRegionSaveState] = useState<SaveState>("idle");
  const [termSaveState, setTermSaveState] = useState<SaveState>("idle");
  const [categoriesSaveState, setCategoriesSaveState] = useState<SaveState>("idle");
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaveState, setNameSaveState] = useState<SaveState>("idle");
  const [activityOpen, setActivityOpen] = useState(false);
  const removeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const UNDO_WINDOW_MS = 6000;

  useEffect(() => {
    const timers = removeTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const currentDealId = selectedDealId ?? dealParam ?? dealsQuery.data?.[0]?.id ?? "";

  const dealQuery = useDealQuery(currentDealId);

  const addLineItemMutation = useAddLineItemMutation(currentDealId);
  const updateLineItemMutation = useUpdateLineItemMutation(currentDealId);
  const removeLineItemMutation = useRemoveLineItemMutation(currentDealId);
  const decisionMutation = useDecisionMutation(currentDealId);
  const lineItemApprovalMutation = useLineItemApprovalMutation(currentDealId);
  const undoLineItemMutation = useUndoLineItemDecisionMutation(currentDealId);
  const approvalMutation = useApprovalMutation(currentDealId);
  const undoApprovalMutation = useUndoApprovalMutation(currentDealId);
  const updateDealMutation = useUpdateDealMutation(currentDealId);

  const rawDealValueTotal = (dealQuery.data?.lineItems ?? [])
    .filter((li) => !removedIds.has(li.lineItem.id))
    .reduce((s, li) => s + li.lineItem.dealValue, 0);
  const animatedDealValueTotal = useCountUp(rawDealValueTotal);
  const animatedBlended = useCountUp(dealQuery.data?.blendedDiscountPct ?? 0);

  // The full summary card sits below every line item, so while a rep is
  // editing up top the policy read is off-screen. A compact sticky version
  // shows only while the real card is scrolled out of view — never both.
  const summaryRef = useRef<HTMLElement | null>(null);
  const [summaryInView, setSummaryInView] = useState(true);
  useEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setSummaryInView(entry?.isIntersecting ?? true),
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentDealId, dealQuery.data]);

  if (!isSignedIn) {
    return <CenteredMessage>Redirecting to sign in…</CenteredMessage>;
  }
  if (dealsQuery.isPending) {
    return <CenteredMessage>Loading deals…</CenteredMessage>;
  }
  if (dealsQuery.isError) {
    return (
      <CenteredMessage>Couldn&apos;t load deals: {errorMessage(dealsQuery.error)}</CenteredMessage>
    );
  }

  const deal = dealQuery.data;
  const region: Region = deal?.deal.region ?? "north_america";
  const lineItems = (deal?.lineItems ?? []).filter((li) => !removedIds.has(li.lineItem.id));
  const blended = deal?.blendedDiscountPct ?? 0;
  const policy = policyStatus(blended);
  // The policy pill is a fact about the numbers and never reverts once a
  // deal exceeds the ceiling — a manager's decision doesn't retroactively
  // bring the discount back in range. Once one exists, show that decision
  // instead of leaving a red "Exceeds Policy" pill sitting next to a
  // disabled "Deal Approved" button, which reads as contradictory.
  const approvalState = deal?.deal.approvalState ?? null;
  const dealBadge =
    policy.status === "within"
      ? { label: "Within Range", cls: "bg-success-soft text-success" }
      : approvalState === "approved"
        ? { label: "Approved", cls: "bg-success-soft text-success" }
        : approvalState === "rejected"
          ? { label: "Changes Requested", cls: "bg-warning-soft text-warning" }
          : { label: "Exceeds Policy", cls: "bg-danger-soft text-danger" };
  const managerActionsEnabled = blended > POLICY_CEILING_PCT;
  const dealValueTotal = rawDealValueTotal;

  // Same weighting as the backend's blended_discount_pct, with one line
  // swapped for a hypothetical value, so a proposal can preview its effect
  // on the whole deal before it is submitted.
  const blendedIfLineAt = (lineItemId: string, pctValue: number) => {
    let total = 0;
    let weighted = 0;
    for (const li of lineItems) {
      const effective =
        li.lineItem.id === lineItemId
          ? pctValue
          : (li.lineItem.appliedDiscountPct ?? li.recommendation.recommendedPct);
      total += li.lineItem.dealValue;
      weighted += li.lineItem.dealValue * effective;
    }
    return total === 0 ? 0 : Math.round((weighted / total) * 10) / 10;
  };

  const handleAddLineItem = () => {
    const body = nextLineItemDefaults(lineItems.length);
    addLineItemMutation.mutate(body, {
      onError: (error) =>
        toast.error("Couldn't add line item", { description: errorMessage(error) }),
    });
  };

  const handlePatch = (
    lineItemId: string,
    patch: { productCategory?: ProductCategory; dealValue?: number },
  ) => {
    updateLineItemMutation.mutate(
      { lineItemId, body: patch },
      {
        onError: (error) =>
          toast.error("Couldn't update line item", { description: errorMessage(error) }),
      },
    );
  };

  const handleSoftRemove = (detail: LineItemDetail) => {
    const lineItemId = detail.lineItem.id;
    setRemovedIds((prev) => new Set(prev).add(lineItemId));

    const restore = () => {
      const timer = removeTimers.current.get(lineItemId);
      if (timer) clearTimeout(timer);
      removeTimers.current.delete(lineItemId);
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.delete(lineItemId);
        return next;
      });
    };

    toast(`${detail.lineItem.productCategory} removed`, {
      description: formatMoney(detail.lineItem.dealValue, region),
      duration: UNDO_WINDOW_MS,
      action: { label: "Undo", onClick: restore },
    });

    const timer = setTimeout(() => {
      removeTimers.current.delete(lineItemId);
      removeLineItemMutation.mutate(lineItemId, {
        onError: (error) => {
          toast.error("Couldn't remove line item", { description: errorMessage(error) });
          restore();
        },
      });
    }, UNDO_WINDOW_MS);
    removeTimers.current.set(lineItemId, timer);
  };

  // Reject on failure so the panel can keep its edit form open; the toast
  // here is the single place decision errors surface.
  const handleAccept = async (lineItemId: string) => {
    try {
      await decisionMutation.mutateAsync({ lineItemId, body: { action: "accept" } });
    } catch (error) {
      toast.error("Couldn't accept the recommendation", { description: errorMessage(error) });
      throw error;
    }
  };

  const handlePropose = async (lineItemId: string, discountPct: number, reason: string) => {
    try {
      const result = await decisionMutation.mutateAsync({
        lineItemId,
        body: { action: "propose", appliedDiscountPct: discountPct, reason },
      });
      if (result.lineItem.lineApprovalState === "pending_approval") {
        toast.info(`Proposal sent for manager approval at ${discountPct}%`);
      } else {
        toast.success(`Applied ${discountPct}%, within the auto-approve range`);
      }
    } catch (error) {
      toast.error("Couldn't submit your proposal", { description: errorMessage(error) });
      throw error;
    }
  };

  const handleResolveLineApproval = async (
    lineItemId: string,
    decision: "approved" | "rejected",
  ) => {
    try {
      await lineItemApprovalMutation.mutateAsync({ lineItemId, body: { decision } });
      toast.success(decision === "approved" ? "Proposal approved" : "Proposal rejected");
    } catch (error) {
      toast.error("Couldn't record your decision", { description: errorMessage(error) });
      throw error;
    }
  };

  const handleUndoLineItemDecision = async (lineItemId: string) => {
    try {
      await undoLineItemMutation.mutateAsync(lineItemId);
      toast.success("Decision undone");
    } catch (error) {
      toast.error("Couldn't undo that decision", { description: errorMessage(error) });
      throw error;
    }
  };

  const handleApproval = (decision: "approved" | "rejected", note?: string) => {
    approvalMutation.mutate(
      { decision, note },
      {
        onSuccess: () => {
          if (decision === "rejected") {
            setChangesDialogOpen(false);
            setChangesNote("");
            toast.success("Changes requested", { description: "The rep will see your note on the deal." });
          }
        },
        onError: (error) =>
          toast.error("Couldn't record decision", { description: errorMessage(error) }),
      },
    );
  };

  const undecidedLines = lineItems.filter(
    (li) => li.lineItem.decision === "pending" && li.lineItem.lineApprovalState !== "pending_approval",
  );
  const inReviewLines = lineItems.filter((li) => li.lineItem.lineApprovalState === "pending_approval");
  const decidedCount = lineItems.length - undecidedLines.length - inReviewLines.length;

  // Every decision on every line, newest first, so a manager can read what
  // happened on a deal without opening each line's own history.
  const activity = lineItems
    .flatMap((li, i) =>
      li.lineItem.history.map((h) => ({
        ...h,
        line: i + 1,
        category: li.lineItem.productCategory,
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at));

  const handleAcceptAll = async () => {
    const targets = undecidedLines;
    setAcceptingAll(true);
    try {
      for (const li of targets) {
        await decisionMutation.mutateAsync({ lineItemId: li.lineItem.id, body: { action: "accept" } });
      }
      toast.success(`Accepted ${targets.length} recommendations`, {
        description: "Each line can still be undone on its own.",
      });
    } catch (error) {
      toast.error("Couldn't accept every line", { description: errorMessage(error) });
    } finally {
      setAcceptingAll(false);
    }
  };

  const jumpToPendingLine = () => {
    const first = inReviewLines[0];
    if (!first) return;
    document
      .getElementById(`line-${first.lineItem.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // The one sentence a rep or manager actually wants from the summary: am I
  // done, and if not, what is the next move.
  const readiness = (() => {
    const n = lineItems.length;
    if (n === 0) return null;
    const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
    if (readOnly) {
      if (inReviewLines.length > 0)
        return {
          tone: "text-warning",
          text: `${inReviewLines.length} line ${plural(inReviewLines.length, "proposal is", "proposals are")} awaiting your review.`,
        };
      if (undecidedLines.length > 0)
        return { tone: "text-muted-foreground", text: `${undecidedLines.length} of ${n} lines still with the rep.` };
      if (policy.status === "exceeds" && approvalState === null)
        return { tone: "text-danger", text: "All lines decided. This deal needs your approval." };
      return { tone: "text-success", text: `All ${n} lines decided.` };
    }
    if (approvalState === "rejected")
      return { tone: "text-warning", text: "Your manager requested changes. Revise and resubmit." };
    if (undecidedLines.length > 0)
      return {
        tone: "text-foreground",
        text: `${undecidedLines.length} of ${n} ${plural(n, "line", "lines")} still ${plural(undecidedLines.length, "needs", "need")} a decision.`,
      };
    if (inReviewLines.length > 0)
      return {
        tone: "text-warning",
        text: `${inReviewLines.length} ${plural(inReviewLines.length, "proposal is", "proposals are")} awaiting manager approval.`,
      };
    if (policy.status === "exceeds")
      return approvalState === "approved"
        ? { tone: "text-success", text: `All ${n} lines decided and approved. Ready to close.` }
        : { tone: "text-danger", text: "All lines decided. Needs manager approval before it can close." };
    return { tone: "text-success", text: `All ${n} lines decided. Ready to close.` };
  })();

  const handleUndoApproval = () => {
    undoApprovalMutation.mutate(undefined, {
      onError: (error) =>
        toast.error("Couldn't undo decision", { description: errorMessage(error) }),
    });
  };

  // Region only changes which currency the deal's numbers are *interpreted*
  // and displayed in going forward — it never rewrites the underlying
  // numbers, same as re-labeling a spreadsheet column without recalculating
  // the values in it.
  const flashSaved = (setState: (s: SaveState) => void) => {
    setState("saved");
    setTimeout(() => setState("idle"), 2000);
  };

  const handleRegionChange = (nextRegion: string) => {
    setRegionSaveState("saving");
    updateDealMutation.mutate(
      { region: nextRegion as Region },
      {
        onSuccess: () => flashSaved(setRegionSaveState),
        onError: (error) => {
          setRegionSaveState("idle");
          toast.error("Couldn't update region", { description: errorMessage(error) });
        },
      },
    );
  };

  const commitName = () => {
    const next = nameDraft.trim();
    setEditingName(false);
    if (!deal || next === "" || next === deal.deal.name) return;
    setNameSaveState("saving");
    updateDealMutation.mutate(
      { name: next },
      {
        onSuccess: () => flashSaved(setNameSaveState),
        onError: (error) => {
          setNameSaveState("idle");
          toast.error("Couldn't rename the deal", { description: errorMessage(error) });
        },
      },
    );
  };

  const handleTermChange = (nextTerm: string) => {
    setTermSaveState("saving");
    updateDealMutation.mutate(
      { termLength: nextTerm as TermLength },
      {
        onSuccess: () => flashSaved(setTermSaveState),
        onError: (error) => {
          setTermSaveState("idle");
          toast.error("Couldn't update term length", { description: errorMessage(error) });
        },
      },
    );
  };

  const handleProductCategoriesChange = (next: ProductCategory[]) => {
    setCategoriesSaveState("saving");
    updateDealMutation.mutate(
      { productCategories: next },
      {
        onSuccess: () => flashSaved(setCategoriesSaveState),
        onError: (error) => {
          setCategoriesSaveState("idle");
          toast.error("Couldn't update product categories", { description: errorMessage(error) });
        },
      },
    );
  };

  const managerActions =
    readOnly && deal ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          disabled={
            !managerActionsEnabled || deal.deal.approvalState !== null || approvalMutation.isPending
          }
          onClick={() => handleApproval("approved")}
        >
          {deal.deal.approvalState === "approved" ? "Deal Approved" : "Approve Deal"}
        </Button>
        <Button
          variant="outline"
          disabled={
            !managerActionsEnabled || deal.deal.approvalState !== null || approvalMutation.isPending
          }
          onClick={() => setChangesDialogOpen(true)}
        >
          {deal.deal.approvalState === "rejected" ? "Changes Requested" : "Request Changes"}
        </Button>
        {deal.deal.approvalState !== null && (
          <Button
            variant="ghost"
            disabled={undoApprovalMutation.isPending}
            onClick={handleUndoApproval}
          >
            Undo decision
          </Button>
        )}
      </div>
    ) : null;

  const showStickySummary = !!deal && lineItems.length > 0 && !summaryInView;

  return (
    <div className="min-h-screen pb-28">
      <TopNav right={<AccountMenu />} />

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
        {/* Deal header */}
        <section className="surface-card p-6">
          <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-6 text-sm">
            <Link
              href="/"
              className="flex items-center gap-2 pressable rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All deals
            </Link>
            <span className="text-muted-foreground" aria-hidden="true">
              /
            </span>
            <Select value={currentDealId} onValueChange={setSelectedDealId}>
              <SelectTrigger
                aria-label="Switch deal"
                className="h-8 w-auto min-w-[220px] max-w-[420px] gap-2 border-none bg-transparent px-2 font-semibold shadow-none hover:bg-muted"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dealsQuery.data.map((d) => {
                  const policy = policyStatus(d.blendedDiscountPct);
                  return (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            policy.status === "exceeds" ? "bg-danger" : "bg-success"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{d.name}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {dealQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading deal…</p>
          ) : dealQuery.isError ? (
            <p className="text-sm font-medium text-danger">
              Couldn&apos;t load this deal: {errorMessage(dealQuery.error)}
            </p>
          ) : deal ? (
            <div className="grid gap-6 lg:grid-cols-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="label-caps" id="deal-name-label">
                    Deal name
                  </span>
                  <SaveStateIndicator state={nameSaveState} />
                </div>
                {readOnly ? (
                  <h1 className="mt-2 text-sm font-medium">{deal.deal.name}</h1>
                ) : editingName ? (
                  <Input
                    id="deal-name"
                    aria-labelledby="deal-name-label"
                    autoFocus
                    className="mt-2 font-medium"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitName();
                      if (e.key === "Escape") {
                        setNameDraft(deal.deal.name);
                        setEditingName(false);
                      }
                    }}
                  />
                ) : (
                  <h1 className="mt-2 text-sm font-medium">
                    <button
                      type="button"
                      id="deal-name"
                      onClick={() => {
                        setNameDraft(deal.deal.name);
                        setEditingName(true);
                      }}
                      aria-label={`Rename ${deal.deal.name}`}
                      title="Rename deal"
                      className="pressable group -mx-2 flex max-w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="truncate">{deal.deal.name}</span>
                      <Pencil
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                      />
                    </button>
                  </h1>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="label-caps" id="deal-term-label">
                    Term length
                  </span>
                  <SaveStateIndicator state={termSaveState} />
                </div>
                <div className="mt-2">
                  {readOnly ? (
                    <p className="py-2 text-sm font-medium">
                      {TERM_LENGTH_LABEL[deal.deal.termLength]}
                    </p>
                  ) : (
                    <Segmented
                      aria-labelledby="deal-term-label"
                      value={deal.deal.termLength}
                      onChange={handleTermChange}
                      disabled={updateDealMutation.isPending}
                      options={TERM_LENGTHS.map((term) => ({
                        value: term,
                        label: TERM_LENGTH_LABEL[term].replace(" months", " mo"),
                      }))}
                      className="w-full"
                    />
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="label-caps">Product categories</span>
                  <SaveStateIndicator state={categoriesSaveState} />
                </div>
                <div className="mt-2">
                  <CategoryMultiSelect
                    value={deal.deal.productCategories}
                    onChange={handleProductCategoriesChange}
                    disabled={readOnly}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tags for search and reporting. Each line item sets its own category below.
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="label-caps" htmlFor="deal-region">
                    Region
                  </label>
                  <SaveStateIndicator state={regionSaveState} />
                </div>
                <div className="mt-2">
                  <Select value={region} onValueChange={handleRegionChange}>
                    <SelectTrigger id="deal-region" disabled={updateDealMutation.isPending}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label} ({r.currencyCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {lineItems.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Line item values aren&apos;t converted automatically. Enter values in the new currency.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  FX rates last synced {formatFxAsOf()}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        {deal && (
          <>
            {/* Line items */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-base font-semibold tracking-tight">Line Items</h2>
                  {lineItems.length > 0 && (
                    <>
                      <ProgressSegments
                        total={lineItems.length}
                        decided={decidedCount}
                        inReview={inReviewLines.length}
                      />
                      <span className="text-xs text-muted-foreground">
                        {decidedCount} of {lineItems.length} decided
                      </span>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    {lineItems.length} {lineItems.length === 1 ? "line" : "lines"} ·{" "}
                    {formatMoney(dealValueTotal, region)}
                  </p>
                  {!readOnly && undecidedLines.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={acceptingAll || decisionMutation.isPending}
                      onClick={() => void handleAcceptAll()}
                    >
                      {acceptingAll ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Accept all {undecidedLines.length} recommendations
                    </Button>
                  )}
                </div>
              </div>

              {lineItems.length === 0 && !addLineItemMutation.isPending ? (
                <div className="surface-card flex flex-col items-center justify-center px-6 py-16 text-center">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <PackageOpen className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-sm font-semibold">
                    No line items yet. Add one to get started.
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Each line gets its own AI discount recommendation, reasoning, and customer
                    history.
                  </p>
                  {!readOnly && (
                    <Button className="mt-6" onClick={handleAddLineItem}>
                      <Plus className="mr-2 h-4 w-4" /> Add Line Item
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {lineItems.map((detail, i) => (
                    <LineItemCard
                      key={detail.lineItem.id}
                      detail={detail}
                      index={i}
                      readOnly={readOnly}
                      isGenerating={
                        updateLineItemMutation.isPending &&
                        updateLineItemMutation.variables?.lineItemId === detail.lineItem.id
                      }
                      isDeciding={
                        decisionMutation.isPending &&
                        decisionMutation.variables?.lineItemId === detail.lineItem.id
                      }
                      isResolvingApproval={
                        lineItemApprovalMutation.isPending &&
                        lineItemApprovalMutation.variables?.lineItemId === detail.lineItem.id
                      }
                      isUndoingDecision={
                        undoLineItemMutation.isPending &&
                        undoLineItemMutation.variables === detail.lineItem.id
                      }
                      customer={deal.customer}
                      discountHistory={deal.discountHistory}
                      region={region}
                      onPatch={(patch) => handlePatch(detail.lineItem.id, patch)}
                      onRemove={() => handleSoftRemove(detail)}
                      onAccept={() => handleAccept(detail.lineItem.id)}
                      onPropose={(discountPct, reason) =>
                        handlePropose(detail.lineItem.id, discountPct, reason)
                      }
                      onResolveApproval={(decision) =>
                        handleResolveLineApproval(detail.lineItem.id, decision)
                      }
                      onUndoDecision={() => handleUndoLineItemDecision(detail.lineItem.id)}
                      previewBlended={(p) => blendedIfLineAt(detail.lineItem.id, p)}
                    />
                  ))}
                  {addLineItemMutation.isPending && (
                    <section className="surface-card overflow-hidden">
                      <div className="p-6">
                        <p className="text-sm text-muted-foreground">Adding line item…</p>
                      </div>
                      <div className="px-6 pb-6">
                        <AiPanelSkeleton />
                      </div>
                    </section>
                  )}
                </>
              )}

              {!readOnly && lineItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  disabled={addLineItemMutation.isPending}
                  className="pressable-card flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-card/40 py-4 text-sm font-medium text-muted-foreground pressable hover:border-foreground/30 hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {addLineItemMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add Line Item
                </button>
              )}
            </section>

            {/* Deal summary */}
            <section ref={summaryRef} className="surface-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex flex-wrap gap-10">
                  <div>
                    <p className="label-caps">Total deal value</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                      {formatMoney(animatedDealValueTotal, region)}
                    </p>
                    {region !== "north_america" && (
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                        ≈ {currency(toUsd(dealValueTotal, region))} USD
                      </p>
                    )}
                  </div>
                  <div className="min-w-[280px] flex-1">
                    <p className="label-caps">Blended discount</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                      {pct(animatedBlended)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Weighted across all lines</p>
                    <PolicyGauge value={blended} className="mt-3 max-w-md" />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${dealBadge.cls}`}
                  >
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {dealBadge.label}
                  </span>
                  {managerActions}
                </div>
              </div>

              {readiness && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <ProgressSegments
                    total={lineItems.length}
                    decided={decidedCount}
                    inReview={inReviewLines.length}
                    size="md"
                  />
                  <p className={`text-sm font-medium ${readiness.tone}`}>{readiness.text}</p>
                  {readOnly && inReviewLines.length > 0 && (
                    <button
                      type="button"
                      onClick={jumpToPendingLine}
                      className="pressable inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4 hover:opacity-70"
                    >
                      Jump to it
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              <p className="mt-6 max-w-3xl border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground">
                {policy.note} Term: {TERM_LENGTH_LABEL[deal.deal.termLength]}.
              </p>

              {readOnly && !managerActionsEnabled && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Approval actions unlock once the blended discount exceeds 15%.
                </p>
              )}
              {deal.deal.approvalState !== null && (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-foreground">
                    {deal.deal.approvalState === "approved"
                      ? "Deal approved. The rep has been notified."
                      : "Changes requested. Sent back to the rep."}
                  </p>
                  {deal.deal.approvalNote && (
                    <blockquote className="mt-2 max-w-2xl border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">
                      &ldquo;{deal.deal.approvalNote}&rdquo;
                    </blockquote>
                  )}
                </div>
              )}

              {activity.length > 0 && (
                <div className="mt-6 border-t border-border pt-6">
                  <button
                    type="button"
                    onClick={() => setActivityOpen((o) => !o)}
                    aria-expanded={activityOpen}
                    className="pressable inline-flex items-center gap-2 rounded-md text-sm font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${activityOpen ? "rotate-180" : ""}`}
                    />
                    Activity
                    <span className="text-xs text-muted-foreground tabular-nums">{activity.length}</span>
                  </button>
                  {activityOpen && (
                    <ol className="mt-4 space-y-3">
                      {activity.map((h, i) => (
                        <li key={`${h.at}-${i}`} className="flex gap-4 text-sm">
                          <span className="w-24 shrink-0 text-xs text-muted-foreground tabular-nums">
                            {formatWhen(h.at)}
                          </span>
                          <span className="min-w-0 leading-relaxed">
                            <span className="font-medium">{HISTORY_ACTION_LABEL[h.action] ?? h.action}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              on line {h.line} ({h.category}) ·{" "}
                              <span className="tabular-nums">
                                {h.previousPct === null ? "none" : `${h.previousPct}%`} →{" "}
                                {h.newPct === null ? "none" : `${h.newPct}%`}
                              </span>{" "}
                              · {h.by}
                              {h.reason ? <> · &ldquo;{h.reason}&rdquo;</> : null}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {showStickySummary && deal && (
        <aside
          aria-label="Deal policy summary"
          className="fixed inset-x-0 bottom-0 z-30 animate-in fade-in slide-in-from-bottom-2 px-6 pb-4 duration-300"
        >
          <div className="surface-card mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-8 gap-y-3 border-border/80 bg-card/95 px-6 py-4 shadow-lift backdrop-blur">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="hidden min-w-0 max-w-[240px] lg:block">
                <p className="label-caps">Deal</p>
                <p className="truncate text-sm font-semibold leading-tight">{deal.deal.name}</p>
              </div>
              <div className="hidden shrink-0 sm:block">
                <p className="label-caps">Total deal value</p>
                <p className="text-lg font-semibold tabular-nums leading-tight">
                  {formatMoney(animatedDealValueTotal, region)}
                </p>
              </div>
              <div className="w-full shrink-0 sm:w-72">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="label-caps">Blended discount</p>
                  <p className="text-lg font-semibold tabular-nums leading-tight">
                    {pct(animatedBlended)}
                  </p>
                </div>
                <PolicyGauge value={blended} size="sm" showHeadroom={false} className="mt-2" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${dealBadge.cls}`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                {dealBadge.label}
              </span>
              {managerActions}
            </div>
          </div>
        </aside>
      )}

      <Dialog
        open={changesDialogOpen}
        onOpenChange={(next) => {
          setChangesDialogOpen(next);
          if (!next) setChangesNote("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              Tell the rep what needs to change. Your note shows on the deal.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="label-caps" htmlFor="changes-note">
              Note to the rep
            </label>
            <Input
              id="changes-note"
              className="mt-2"
              autoFocus
              value={changesNote}
              onChange={(e) => setChangesNote(e.target.value)}
              placeholder="e.g. Bring the Services line under 20%"
              onKeyDown={(e) => {
                if (e.key === "Enter" && changesNote.trim() !== "" && !approvalMutation.isPending)
                  handleApproval("rejected", changesNote.trim());
              }}
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setChangesDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={changesNote.trim() === "" || approvalMutation.isPending}
              onClick={() => handleApproval("rejected", changesNote.trim())}
            >
              {approvalMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Send back to rep"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
