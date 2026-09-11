"use client";

import { Lock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiPanel, AiPanelEmpty, AiPanelSkeleton } from "@/components/app/ai-panel";
import { PRODUCT_CATEGORIES } from "@/lib/deal-data";
import type {
  Customer,
  DiscountHistoryEntry,
  LineItemDetail,
  ProductCategory,
} from "@/lib/api-types";

const EDIT_DEBOUNCE_MS = 600;

export function LineItemCard({
  detail,
  index,
  readOnly,
  isGenerating,
  isDeciding,
  isResolvingApproval,
  customer,
  discountHistory,
  onPatch,
  onRemove,
  onPropose,
  onAccept,
  onResolveApproval,
}: {
  detail: LineItemDetail;
  index: number;
  readOnly: boolean;
  isGenerating: boolean;
  isDeciding: boolean;
  isResolvingApproval: boolean;
  customer: Customer;
  discountHistory: DiscountHistoryEntry[];
  onPatch: (patch: { productCategory?: ProductCategory; dealValue?: number }) => void;
  onRemove: () => void;
  onPropose: (discountPct: number, reason: string) => Promise<void>;
  onAccept: () => Promise<void>;
  onResolveApproval: (decision: "approved" | "rejected") => Promise<void>;
}) {
  const { lineItem, recommendation } = detail;
  // While a proposal on this line awaits a manager's call, category/value are
  // locked to prevent silently editing the deal out from under the review.
  const isLocked = lineItem.lineApprovalState === "pending_approval";

  // Local drafts so typing doesn't fire a PATCH on every keystroke.
  const [categoryDraft, setCategoryDraft] = useState<ProductCategory>(lineItem.productCategory);
  const [valueDraft, setValueDraft] = useState<string>(String(lineItem.dealValue));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Resyncing local drafts to the server value on every successful save, same
  // as upstream.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCategoryDraft(lineItem.productCategory);
    setValueDraft(String(lineItem.dealValue));
  }, [lineItem.productCategory, lineItem.dealValue]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const valueError =
    valueDraft === "" || Number(valueDraft) <= 0 ? "Deal value must be greater than 0" : null;

  const schedulePatch = (patch: { productCategory?: ProductCategory; dealValue?: number }) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onPatch(patch), EDIT_DEBOUNCE_MS);
  };

  const handleCategoryChange = (category: ProductCategory) => {
    setCategoryDraft(category);
    const value = Number(valueDraft);
    schedulePatch(
      value > 0 ? { productCategory: category, dealValue: value } : { productCategory: category },
    );
  };

  const handleValueChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9-]/g, "");
    const normalized = cleaned.startsWith("-") ? `-${cleaned.slice(1).replace(/-/g, "")}` : cleaned;
    setValueDraft(normalized);
    const numeric = Number(normalized);
    if (normalized === "" || normalized === "-" || numeric <= 0) return;
    schedulePatch({ productCategory: categoryDraft, dealValue: numeric });
  };

  const fieldsReadOnly = readOnly || isLocked;

  return (
    <section className="surface-card overflow-hidden transition-shadow hover:shadow-card-hover">
      {isLocked && (
        <div className="flex items-center gap-1.5 border-b border-warning/30 bg-warning-soft px-5 py-1.5 text-xs font-medium text-warning-foreground">
          <Lock className="h-3 w-3" />
          Locked while a proposal on this line awaits manager approval
        </div>
      )}
      <div className="flex flex-wrap items-start gap-4 p-5">
        <span className="mt-6 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
          {index + 1}
        </span>

        <div className="min-w-[180px] flex-1">
          <label className="label-caps">Product category</label>
          <div className="mt-1.5">
            {fieldsReadOnly ? (
              <p className="py-2 text-sm font-medium">{lineItem.productCategory}</p>
            ) : (
              <Select
                value={categoryDraft}
                onValueChange={(v) => handleCategoryChange(v as ProductCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="min-w-[180px] flex-1">
          <label className="label-caps" htmlFor={`value-${lineItem.id}`}>
            Deal value
          </label>
          <div className="mt-1.5">
            {fieldsReadOnly ? (
              <p className="py-2 text-sm font-medium tabular-nums">
                ${lineItem.dealValue.toLocaleString("en-US")}
              </p>
            ) : (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id={`value-${lineItem.id}`}
                  className="pl-7 tabular-nums"
                  inputMode="numeric"
                  aria-invalid={!!valueError}
                  value={valueDraft}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
          </div>
          {!fieldsReadOnly && valueError && (
            <p className="mt-1.5 text-xs font-medium text-danger">{valueError}</p>
          )}
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={onRemove}
            disabled={isLocked}
            aria-label={`Remove line item ${index + 1}`}
            title={isLocked ? "Locked while a proposal awaits manager approval" : undefined}
            className="mt-6 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-5 pb-5">
        {isGenerating ? (
          <AiPanelSkeleton />
        ) : valueError ? (
          <AiPanelEmpty />
        ) : (
          <AiPanel
            lineItem={lineItem}
            recommendation={recommendation}
            customer={customer}
            discountHistory={discountHistory}
            readOnly={readOnly}
            isDeciding={isDeciding}
            isResolvingApproval={isResolvingApproval}
            onPropose={onPropose}
            onAccept={onAccept}
            onResolveApproval={onResolveApproval}
          />
        )}
      </div>
    </section>
  );
}
