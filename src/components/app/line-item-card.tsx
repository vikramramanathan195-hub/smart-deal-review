import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiPanel, AiPanelEmpty, AiPanelSkeleton } from "@/components/app/ai-panel";
import { PRODUCT_CATEGORIES, type LineItem, type ProductCategory } from "@/lib/deal-data";

export function LineItemCard({
  line,
  index,
  readOnly,
  onChange,
  onRemove,
  onAccept,
  onAdjust,
  onOverride,
}: {
  line: LineItem;
  index: number;
  readOnly: boolean;
  onChange: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
  onAccept: () => void;
  onAdjust: () => void;
  onOverride: () => void;
}) {
  const valueError =
    line.value === "" || Number(line.value) <= 0 ? "Deal value must be greater than 0" : null;
  const categoryError = line.category === "" ? "Select a product category" : null;
  const discountError =
    line.appliedDiscount !== null && line.appliedDiscount > 100
      ? "Discount cannot exceed 100%"
      : null;

  return (
    <section className="surface-card overflow-hidden transition-shadow hover:shadow-card-hover">
      <div className="flex flex-wrap items-start gap-4 p-5">
        <span className="mt-6 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
          {index + 1}
        </span>

        <div className="min-w-[180px] flex-1">
          <label className="label-caps">Product category</label>
          <div className="mt-1.5">
            {readOnly ? (
              <p className="py-2 text-sm font-medium">{line.category || "—"}</p>
            ) : (
              <Select
                value={line.category}
                onValueChange={(v) => onChange({ category: v as ProductCategory })}
              >
                <SelectTrigger aria-invalid={!!categoryError}>
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
          {!readOnly && categoryError && (
            <p className="mt-1.5 text-xs font-medium text-danger">{categoryError}</p>
          )}
        </div>

        <div className="min-w-[180px] flex-1">
          <label className="label-caps" htmlFor={`value-${line.id}`}>
            Deal value
          </label>
          <div className="mt-1.5">
            {readOnly ? (
              <p className="py-2 text-sm font-medium tabular-nums">
                {line.value === "" ? "—" : `$${Number(line.value).toLocaleString("en-US")}`}
              </p>
            ) : (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id={`value-${line.id}`}
                  className="pl-7 tabular-nums"
                  inputMode="numeric"
                  aria-invalid={!!valueError}
                  value={line.value === "" ? "" : String(line.value)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    onChange({ value: raw === "" ? "" : Number(raw) });
                  }}
                  placeholder="0"
                />
              </div>
            )}
          </div>
          {!readOnly && valueError && (
            <p className="mt-1.5 text-xs font-medium text-danger">{valueError}</p>
          )}
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove line item ${index + 1}`}
            className="mt-6 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-5 pb-5">
        {line.generating ? (
          <AiPanelSkeleton />
        ) : line.recommendation ? (
          <>
            <AiPanel
              line={line}
              recommendation={line.recommendation}
              readOnly={readOnly}
              onAccept={onAccept}
              onAdjust={onAdjust}
              onOverride={onOverride}
            />
            {discountError && (
              <p className="mt-2 text-xs font-medium text-danger">{discountError}</p>
            )}
          </>
        ) : (
          <AiPanelEmpty />
        )}
      </div>
    </section>
  );
}
