import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RolePill, TopNav } from "@/components/app/top-nav";
import { LineItemCard } from "@/components/app/line-item-card";
import { useSession } from "@/lib/session";
import {
  PRODUCT_CATEGORIES,
  SAMPLE_DEALS,
  currency,
  effectiveDiscount,
  generateRecommendation,
  newId,
  pct,
  policyStatus,
  type LineItem,
  type ProductCategory,
} from "@/lib/deal-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deal Review · Deal Discount Review" },
      {
        name: "description",
        content:
          "Build multi-line deals, review AI-suggested discounts per line with full reasoning, and check the blended discount against pricing policy.",
      },
      { property: "og:title", content: "Deal Review · Deal Discount Review" },
      {
        property: "og:description",
        content: "Per-line AI discount recommendations with reasoning and policy checks.",
      },
    ],
  }),
  component: Deals,
});

const TERMS = ["12mo", "24mo", "36mo"] as const;

function Deals() {
  const { role } = useSession();
  const readOnly = role === "Manager";

  const firstDeal = SAMPLE_DEALS[0]!;
  const [sampleId, setSampleId] = useState(firstDeal.id);
  const [dealName, setDealName] = useState(firstDeal.name);
  const [term, setTerm] = useState<(typeof TERMS)[number]>(firstDeal.term);
  const [categories, setCategories] = useState<ProductCategory[]>(firstDeal.categories);
  const [lines, setLines] = useState<LineItem[]>(firstDeal.lines);
  const [pendingRemoval, setPendingRemoval] = useState<LineItem | null>(null);
  const [dealDecision, setDealDecision] = useState<null | "approved" | "changes">(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const loadSample = (id: string) => {
    const deal = SAMPLE_DEALS.find((d) => d.id === id);
    if (!deal) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSampleId(deal.id);
    setDealName(deal.name);
    setTerm(deal.term);
    setCategories(deal.categories);
    setLines(deal.lines.map((l) => ({ ...l })));
    setPendingRemoval(null);
    setDealDecision(null);
  };

  const activeSample = SAMPLE_DEALS.find((d) => d.id === sampleId) ?? firstDeal;

  const patchLine = (id: string, patch: Partial<LineItem>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addLineItem = () => {
    const id = newId();
    const category: ProductCategory =
      PRODUCT_CATEGORIES[lines.length % PRODUCT_CATEGORIES.length] ?? "Compute";
    const value = 60000 + ((lines.length * 27500) % 120000);
    setLines((prev) => [
      ...prev,
      {
        id,
        category,
        value,
        decision: "pending",
        appliedDiscount: null,
        generating: true,
        recommendation: null,
      },
    ]);
    const t = setTimeout(() => {
      patchLine(id, { generating: false, recommendation: generateRecommendation(category, value) });
    }, 800);
    timers.current.push(t);
  };

  const regenerate = (id: string, category: ProductCategory | "", value: number | "") => {
    if (!category || value === "" || Number(value) <= 0) {
      patchLine(id, { generating: false, recommendation: null });
      return;
    }
    patchLine(id, { generating: true });
    const t = setTimeout(() => {
      patchLine(id, {
        generating: false,
        recommendation: generateRecommendation(category, Number(value)),
      });
    }, 800);
    timers.current.push(t);
  };

  const dealValue = lines.reduce((s, l) => s + (typeof l.value === "number" ? l.value : 0), 0);
  const weighted = lines.reduce(
    (s, l) => s + (typeof l.value === "number" ? l.value : 0) * effectiveDiscount(l),
    0,
  );
  const blended = dealValue > 0 ? Math.round((weighted / dealValue) * 10) / 10 : 0;
  const policy = policyStatus(blended);
  const statusStyles = {
    within: "bg-success-soft text-success",
    review: "bg-warning-soft text-warning-foreground",
    exceeds: "bg-danger-soft text-danger",
  }[policy.status];
  const managerActionsEnabled = blended > 15;

  return (
    <div className="min-h-screen">
      <TopNav right={<RolePill role={role} />} />

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
        {/* Deal header */}
        <section className="surface-card p-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
            <div>
              <label className="label-caps" htmlFor="sample-deal">
                Sample deal
              </label>
              <div className="mt-1.5 w-[280px]">
                <Select value={sampleId} onValueChange={loadSample}>
                  <SelectTrigger id="sample-deal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SAMPLE_DEALS.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="max-w-md text-xs text-muted-foreground">{activeSample.summary}</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="label-caps" htmlFor="deal-name">
                Deal name
              </label>
              {readOnly ? (
                <p className="mt-2 text-sm font-medium">{dealName}</p>
              ) : (
                <>
                  <Input
                    id="deal-name"
                    className="mt-1.5"
                    value={dealName}
                    aria-invalid={!dealName.trim()}
                    onChange={(e) => setDealName(e.target.value)}
                  />
                  {!dealName.trim() && (
                    <p className="mt-1.5 text-xs font-medium text-danger">
                      Deal name is required before submitting for review
                    </p>
                  )}
                </>
              )}
            </div>

            <div>
              <span className="label-caps">Term length</span>
              <div className="mt-1.5 inline-flex rounded-lg border border-border bg-secondary p-1">
                {TERMS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setTerm(t)}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                      term === t
                        ? "bg-card text-foreground shadow-card"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label-caps">Product categories</span>
              <div className="mt-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={readOnly}>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      {categories.length ? categories.join(", ") : "Select categories"}
                      <span className="ml-2 text-muted-foreground">▾</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="start">
                    {PRODUCT_CATEGORIES.map((c) => (
                      <DropdownMenuCheckboxItem
                        key={c}
                        checked={categories.includes(c)}
                        onCheckedChange={(checked) =>
                          setCategories((prev) =>
                            checked ? [...prev, c] : prev.filter((p) => p !== c),
                          )
                        }
                      >
                        {c}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {categories.length === 0 && (
                <p className="mt-1.5 text-xs font-medium text-danger">
                  Select at least one product category
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Line items */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold tracking-tight">Line Items</h2>
            <p className="text-xs text-muted-foreground">
              {lines.length} {lines.length === 1 ? "line" : "lines"} · {currency(dealValue)}
            </p>
          </div>

          {lines.length === 0 ? (
            <div className="surface-card flex flex-col items-center justify-center px-6 py-16 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <PackageOpen className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm font-semibold">No line items yet — add one to get started</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Each line gets its own AI discount recommendation, reasoning, and customer history.
              </p>
              {!readOnly && (
                <Button className="mt-5" onClick={addLineItem}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add Line Item
                </Button>
              )}
            </div>
          ) : (
            lines.map((line, i) => (
              <LineItemCard
                key={line.id}
                line={line}
                index={i}
                readOnly={readOnly}
                onChange={(patch) => {
                  patchLine(line.id, patch);
                  const nextCategory = patch.category ?? line.category;
                  const nextValue = patch.value ?? line.value;
                  if ("category" in patch || "value" in patch)
                    regenerate(line.id, nextCategory, nextValue);
                }}
                onRemove={() => setPendingRemoval(line)}
                onAccept={() =>
                  patchLine(line.id, {
                    decision: "accepted",
                    appliedDiscount: line.recommendation?.discount ?? null,
                  })
                }
                onAdjust={() =>
                  patchLine(line.id, {
                    decision: "adjusted",
                    appliedDiscount: Math.max(
                      0,
                      Math.round(((line.recommendation?.discount ?? 0) - 1.5) * 10) / 10,
                    ),
                  })
                }
                onOverride={() =>
                  patchLine(line.id, {
                    decision: "overridden",
                    appliedDiscount: Math.round(((line.recommendation?.discount ?? 0) + 3) * 10) / 10,
                  })
                }
              />
            ))
          )}

          {!readOnly && lines.length > 0 && (
            <button
              type="button"
              onClick={addLineItem}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-card/40 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-ai hover:bg-ai-softer hover:text-ai"
            >
              <Plus className="h-4 w-4" /> Add Line Item
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
                  {currency(dealValue)}
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
                <div className="flex gap-2">
                  <Button
                    disabled={!managerActionsEnabled}
                    onClick={() => setDealDecision("approved")}
                  >
                    Approve Deal
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!managerActionsEnabled}
                    onClick={() => setDealDecision("changes")}
                  >
                    Request Changes
                  </Button>
                </div>
              )}
            </div>
          </div>

          <p className="mt-5 max-w-3xl border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">
            {policy.note} Term: {term}.
          </p>

          {readOnly && !managerActionsEnabled && (
            <p className="mt-2 text-xs text-muted-foreground">
              Approval actions unlock once the blended discount exceeds 15%.
            </p>
          )}
          {dealDecision && (
            <p className="mt-3 text-sm font-semibold text-ai">
              {dealDecision === "approved"
                ? "Deal approved — the rep has been notified."
                : "Changes requested — sent back to the rep with your note."}
            </p>
          )}
        </section>
      </main>

      <AlertDialog
        open={!!pendingRemoval}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this line item?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval?.category || "This line"}
              {pendingRemoval && typeof pendingRemoval.value === "number"
                ? ` · ${currency(pendingRemoval.value)}`
                : ""}{" "}
              will be removed from the deal, along with its AI recommendation and decision. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep line item</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLines((prev) => prev.filter((l) => l.id !== pendingRemoval?.id));
                setPendingRemoval(null);
              }}
            >
              Remove line item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
