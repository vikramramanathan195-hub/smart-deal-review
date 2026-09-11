"use client";

import { useState } from "react";
import { Plus, PackageOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TopNav } from "@/components/app/top-nav";
import { AccountMenu } from "@/components/app/account-menu";
import { LineItemCard } from "@/components/app/line-item-card";
import { AiPanelSkeleton } from "@/components/app/ai-panel";
import { useSession } from "@/lib/session";
import { currency, pct, policyStatus, PRODUCT_CATEGORIES } from "@/lib/deal-data";
import type { LineItemDetail, ProductCategory } from "@/lib/api-types";
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
  useRemoveLineItemMutation,
  useUndoApprovalMutation,
  useUpdateLineItemMutation,
} from "@/lib/queries";
import { ApiError } from "@/lib/api";

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
  const { role } = useSession();
  const readOnly = role === "manager";

  const dealsQuery = useDealsQuery();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<LineItemDetail | null>(null);

  const currentDealId = selectedDealId ?? dealsQuery.data?.[0]?.id ?? "";

  const dealQuery = useDealQuery(currentDealId);

  const addLineItemMutation = useAddLineItemMutation(currentDealId);
  const updateLineItemMutation = useUpdateLineItemMutation(currentDealId);
  const removeLineItemMutation = useRemoveLineItemMutation(currentDealId);
  const decisionMutation = useDecisionMutation(currentDealId);
  const lineItemApprovalMutation = useLineItemApprovalMutation(currentDealId);
  const approvalMutation = useApprovalMutation(currentDealId);
  const undoApprovalMutation = useUndoApprovalMutation(currentDealId);

  if (dealsQuery.isPending) {
    return <CenteredMessage>Loading deals…</CenteredMessage>;
  }
  if (dealsQuery.isError) {
    return (
      <CenteredMessage>Couldn&apos;t load deals — {errorMessage(dealsQuery.error)}</CenteredMessage>
    );
  }

  const deal = dealQuery.data;
  const lineItems = deal?.lineItems ?? [];
  const blended = deal?.blendedDiscountPct ?? 0;
  const policy = policyStatus(blended);
  const statusStyles = {
    within: "bg-success-soft text-success",
    exceeds: "bg-danger-soft text-danger",
  }[policy.status];
  const managerActionsEnabled = blended > 15;
  const dealValueTotal = lineItems.reduce((s, li) => s + li.lineItem.dealValue, 0);

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

  const handleRemove = (lineItemId: string) => {
    removeLineItemMutation.mutate(lineItemId, {
      onSuccess: () => setPendingRemoval(null),
      onError: (error) => {
        toast.error("Couldn't remove line item", { description: errorMessage(error) });
        setPendingRemoval(null);
      },
    });
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
        toast.success(`Applied ${discountPct}% — within the auto-approve range`);
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

  const handleApproval = (decision: "approved" | "rejected") => {
    approvalMutation.mutate(
      { decision },
      {
        onError: (error) =>
          toast.error("Couldn't record decision", { description: errorMessage(error) }),
      },
    );
  };

  const handleUndoApproval = () => {
    undoApprovalMutation.mutate(undefined, {
      onError: (error) =>
        toast.error("Couldn't undo decision", { description: errorMessage(error) }),
    });
  };

  return (
    <div className="min-h-screen">
      <TopNav right={<AccountMenu />} />

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
        {/* Deal header */}
        <section className="surface-card p-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
            <div>
              <label className="label-caps" htmlFor="sample-deal">
                Sample deal
              </label>
              <div className="mt-1.5 w-[280px]">
                <Select value={currentDealId} onValueChange={setSelectedDealId}>
                  <SelectTrigger id="sample-deal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dealsQuery.data.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {dealQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading deal…</p>
          ) : dealQuery.isError ? (
            <p className="text-sm font-medium text-danger">
              Couldn&apos;t load this deal — {errorMessage(dealQuery.error)}
            </p>
          ) : deal ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <div>
                <label className="label-caps">Deal name</label>
                <p className="mt-2 text-sm font-medium">{deal.deal.name}</p>
              </div>
              <div>
                <span className="label-caps">Term length</span>
                <p className="mt-2 text-sm font-medium">{deal.deal.termLength}</p>
              </div>
              <div>
                <span className="label-caps">Product categories</span>
                <p className="mt-2 text-sm font-medium">{deal.deal.productCategories.join(", ")}</p>
              </div>
            </div>
          ) : null}
        </section>

        {deal && (
          <>
            {/* Line items */}
            <section className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold tracking-tight">Line Items</h2>
                <p className="text-xs text-muted-foreground">
                  {lineItems.length} {lineItems.length === 1 ? "line" : "lines"} ·{" "}
                  {currency(dealValueTotal)}
                </p>
              </div>

              {lineItems.length === 0 && !addLineItemMutation.isPending ? (
                <div className="surface-card flex flex-col items-center justify-center px-6 py-16 text-center">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <PackageOpen className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-sm font-semibold">
                    No line items yet — add one to get started
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Each line gets its own AI discount recommendation, reasoning, and customer
                    history.
                  </p>
                  {!readOnly && (
                    <Button className="mt-5" onClick={handleAddLineItem}>
                      <Plus className="mr-1.5 h-4 w-4" /> Add Line Item
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
                      customer={deal.customer}
                      discountHistory={deal.discountHistory}
                      onPatch={(patch) => handlePatch(detail.lineItem.id, patch)}
                      onRemove={() => setPendingRemoval(detail)}
                      onAccept={() => handleAccept(detail.lineItem.id)}
                      onPropose={(discountPct, reason) =>
                        handlePropose(detail.lineItem.id, discountPct, reason)
                      }
                      onResolveApproval={(decision) =>
                        handleResolveLineApproval(detail.lineItem.id, decision)
                      }
                    />
                  ))}
                  {addLineItemMutation.isPending && (
                    <section className="surface-card overflow-hidden">
                      <div className="p-5">
                        <p className="text-sm text-muted-foreground">Adding line item…</p>
                      </div>
                      <div className="px-5 pb-5">
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-card/40 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-ai hover:bg-ai-softer hover:text-ai disabled:cursor-not-allowed disabled:opacity-60"
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
            <section className="surface-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex flex-wrap gap-10">
                  <div>
                    <p className="label-caps">Total deal value</p>
                    <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums">
                      {currency(dealValueTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="label-caps">Blended discount</p>
                    <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums">
                      {pct(blended)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Weighted across all lines</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${statusStyles}`}
                  >
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {policy.label}
                  </span>
                  {readOnly && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        disabled={
                          !managerActionsEnabled ||
                          deal.deal.approvalState !== null ||
                          approvalMutation.isPending
                        }
                        onClick={() => handleApproval("approved")}
                      >
                        {deal.deal.approvalState === "approved" ? "Deal Approved" : "Approve Deal"}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          !managerActionsEnabled ||
                          deal.deal.approvalState !== null ||
                          approvalMutation.isPending
                        }
                        onClick={() => handleApproval("rejected")}
                      >
                        {deal.deal.approvalState === "rejected"
                          ? "Changes Requested"
                          : "Request Changes"}
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
                  )}
                </div>
              </div>

              <p className="mt-5 max-w-3xl border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
                {policy.note} Term: {deal.deal.termLength}.
              </p>

              {readOnly && !managerActionsEnabled && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Approval actions unlock once the blended discount exceeds 15%.
                </p>
              )}
              {deal.deal.approvalState !== null && (
                <p className="mt-3 text-sm font-semibold text-ai">
                  {deal.deal.approvalState === "approved"
                    ? "Deal approved — the rep has been notified."
                    : "Changes requested — sent back to the rep."}
                </p>
              )}
            </section>
          </>
        )}
      </main>

      <AlertDialog
        open={!!pendingRemoval}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this line item?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval?.lineItem.productCategory ?? "This line"}
              {pendingRemoval ? ` · ${currency(pendingRemoval.lineItem.dealValue)}` : ""} will be
              removed from the deal, along with its AI recommendation and decision. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep line item</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeLineItemMutation.isPending}
              onClick={() => pendingRemoval && handleRemove(pendingRemoval.lineItem.id)}
            >
              Remove line item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
