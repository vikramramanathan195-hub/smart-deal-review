"use client";

import { Copy, Lock, X } from "lucide-react";
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
import { SaveStateIndicator, type SaveState } from "@/components/app/save-state";
import { formatMoney, pct, PRODUCT_CATEGORIES } from "@/lib/deal-data";
import { currencySymbol, regionInfo } from "@/lib/fx-rates";
import type {
  Customer,
  DiscountHistoryEntry,
  LineItemDetail,
  ProductCategory,
  Region,
} from "@/lib/api-types";

const EDIT_DEBOUNCE_MS = 600;

/** Groups digits the way the deal's own currency displays them (220,000 in
 * the US, 220.000 in the Eurozone, 1,83,000 in India) so the field and the
 * figures beside it agree. "-" and "" pass through so the field doesn't
 * fight the user mid-edit. */
function formatDigits(raw: string, locale: string): string {
  if (raw === "" || raw === "-") return raw;
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  if (digits === "") return raw;
  const grouped = Number(digits).toLocaleString(locale, { maximumFractionDigits: 0 });
  return negative ? `-${grouped}` : grouped;
}

export function LineItemCard({
  detail,
  index,
  readOnly,
  isGenerating,
  isDeciding,
  isResolvingApproval,
  isUndoingDecision,
  customer,
  discountHistory,
  region,
  onPatch,
  onRemove,
  onPropose,
  onAccept,
  onResolveApproval,
  onUndoDecision,
  onDuplicate,
  previewBlended,
  onGetAiTake,
}: {
  detail: LineItemDetail;
  index: number;
  readOnly: boolean;
  isGenerating: boolean;
  isDeciding: boolean;
  isResolvingApproval: boolean;
  isUndoingDecision: boolean;
  customer: Customer;
  discountHistory: DiscountHistoryEntry[];
  region: Region;
  onPatch: (patch: { productCategory?: ProductCategory; dealValue?: number }) => void;
  onRemove: () => void;
  onPropose: (discountPct: number, reason: string) => Promise<void>;
  onAccept: () => Promise<void>;
  onResolveApproval: (decision: "approved" | "rejected") => Promise<void>;
  onUndoDecision: () => Promise<void>;
  onDuplicate: () => void;
  previewBlended: (pct: number) => number;
  onGetAiTake?: () => Promise<string>;
}) {
  const { lineItem, recommendation } = detail;
  // While a proposal on this line awaits a manager's call, category/value are
  // locked to prevent silently editing the deal out from under the review.
  const isLocked = lineItem.lineApprovalState === "pending_approval";

  // Local drafts so typing doesn't fire a PATCH on every keystroke.
  const [categoryDraft, setCategoryDraft] = useState<ProductCategory>(lineItem.productCategory);
  const [valueDraft, setValueDraft] = useState<string>(String(lineItem.dealValue));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // isGenerating mirrors the update mutation's isPending for this line item,
  // so it's the source of truth for when a save actually lands — the debounce
  // timer above only tracks the "about to save" window before that.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isGenerating) {
      setSaveState("saving");
      return;
    }
    setSaveState((prev) => {
      if (prev !== "saving") return prev;
      clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaveState("idle"), 2000);
      return "saved";
    });
  }, [isGenerating]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => () => clearTimeout(savedTimeoutRef.current), []);

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
    setSaveState("pending");
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

  // Manually rewrites the DOM input's value + cursor before React re-renders,
  // so adding a thousands separator (e.g. typing the 4th digit of "1234")
  // never bounces the caret to the end of the field — the classic bug with
  // live-formatted number inputs.
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const cursor = input.selectionStart ?? input.value.length;
    const digitsBeforeCursor = input.value.slice(0, cursor).replace(/[^0-9-]/g, "").length;

    const cleaned = input.value.replace(/[^0-9-]/g, "");
    const normalized = cleaned.startsWith("-") ? `-${cleaned.slice(1).replace(/-/g, "")}` : cleaned;
    const formatted = formatDigits(normalized, locale);

    let count = 0;
    let newCursor = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/[0-9-]/.test(formatted[i]!)) count++;
      if (count === digitsBeforeCursor) {
        newCursor = i + 1;
        break;
      }
    }
    if (digitsBeforeCursor === 0) newCursor = 0;

    input.value = formatted;
    input.setSelectionRange(newCursor, newCursor);

    setValueDraft(normalized);
    const numeric = Number(normalized);
    if (normalized === "" || normalized === "-" || numeric <= 0) return;
    schedulePatch({ productCategory: categoryDraft, dealValue: numeric });
  };

  const fieldsReadOnly = readOnly || isLocked;
  const locale = regionInfo(region).locale;

  // Decision state in the header so a deal can be scanned line by line
  // without opening each AI panel to find out what has been settled.
  const appliedPct = lineItem.appliedDiscountPct ?? recommendation.recommendedPct;
  const lineStatus =
    lineItem.lineApprovalState === "pending_approval"
      ? {
          label: `Proposed ${pct(lineItem.pendingDiscountPct ?? 0)} · in review`,
          cls: "bg-warning-soft text-warning",
        }
      : lineItem.decision === "pending"
        ? { label: "Needs decision", cls: "bg-secondary text-muted-foreground" }
        : {
            label: `${lineItem.decision === "accepted" ? "Accepted" : "Applied"} ${pct(appliedPct)}`,
            cls: "bg-success-soft text-success",
          };

  return (
    <section
      id={`line-${lineItem.id}`}
      className="surface-card animate-in fade-in slide-in-from-top-2 overflow-hidden duration-300 transition-shadow hover:shadow-card-hover"
    >
      {isLocked && (
        <div className="flex items-center gap-2 border-b border-warning/30 bg-warning-soft px-6 py-2 text-xs font-medium text-warning">
          <Lock className="h-3 w-3" />
          Locked while a proposal on this line awaits manager approval
        </div>
      )}
      <div className="p-6">
        {!fieldsReadOnly && (
          <div className="mb-2 flex h-4 justify-end">
            <SaveStateIndicator state={saveState} />
          </div>
        )}
        <div className="flex flex-wrap items-start gap-4">
        <span className="mt-6 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
          {index + 1}
        </span>

        <div className="min-w-[180px] flex-1">
          <label className="label-caps" htmlFor={`category-${lineItem.id}`}>
            Product category
          </label>
          <div className="mt-2">
            {fieldsReadOnly ? (
              <p className="py-2 text-sm font-medium">{lineItem.productCategory}</p>
            ) : (
              <Select
                value={categoryDraft}
                onValueChange={(v) => handleCategoryChange(v as ProductCategory)}
              >
                <SelectTrigger id={`category-${lineItem.id}`}>
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
          <div className="mt-2">
            {fieldsReadOnly ? (
              <p className="py-2 text-sm font-medium tabular-nums">
                {formatMoney(lineItem.dealValue, region)}
              </p>
            ) : (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {currencySymbol(region)}
                </span>
                <Input
                  id={`value-${lineItem.id}`}
                  className="pl-8 tabular-nums"
                  inputMode="numeric"
                  aria-invalid={!!valueError}
                  value={formatDigits(valueDraft, locale)}
                  onChange={handleValueChange}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    const step = (e.shiftKey ? 10000 : 1000) * (e.key === "ArrowUp" ? 1 : -1);
                    const next = Math.max(0, (Number(valueDraft) || 0) + step);
                    setValueDraft(String(next));
                    if (next > 0) schedulePatch({ productCategory: categoryDraft, dealValue: next });
                  }}
                  placeholder="0"
                />
              </div>
            )}
          </div>
          {!fieldsReadOnly && valueError && (
            <p className="mt-2 text-xs font-medium text-danger">{valueError}</p>
          )}
        </div>

        <span
          className={`mt-6 inline-flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-semibold ${lineStatus.cls}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {lineStatus.label}
        </span>

        {!readOnly && (
          <button
            type="button"
            onClick={onDuplicate}
            aria-label={`Duplicate line item ${index + 1}`}
            title="Duplicate line"
            className="mt-6 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground pressable hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Copy className="h-4 w-4" />
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={onRemove}
            disabled={isLocked}
            aria-label={`Remove line item ${index + 1}`}
            title={isLocked ? "Locked while a proposal awaits manager approval" : undefined}
            className="mt-6 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground pressable hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        </div>
      </div>

      <div className="px-6 pb-6">
        {isGenerating ? (
          <AiPanelSkeleton />
        ) : valueError ? (
          <AiPanelEmpty />
        ) : (
          <div key={lineItem.id} className="animate-in fade-in duration-300">
            <AiPanel
              lineItem={lineItem}
              recommendation={recommendation}
              customer={customer}
              discountHistory={discountHistory}
              region={region}
              readOnly={readOnly}
              isDeciding={isDeciding}
              isResolvingApproval={isResolvingApproval}
              isUndoingDecision={isUndoingDecision}
              onPropose={onPropose}
              onAccept={onAccept}
              onResolveApproval={onResolveApproval}
              onUndoDecision={onUndoDecision}
              previewBlended={previewBlended}
              onGetAiTake={onGetAiTake}
            />
          </div>
        )}
      </div>
    </section>
  );
}
