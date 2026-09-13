"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PRODUCT_CATEGORIES } from "@/lib/deal-data";
import type { ProductCategory } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export function CategoryMultiSelect({
  value,
  onChange,
  disabled,
}: {
  value: ProductCategory[];
  onChange: (next: ProductCategory[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (category: ProductCategory) => {
    if (value.includes(category)) {
      // A deal must keep at least one product category.
      if (value.length === 1) return;
      onChange(value.filter((c) => c !== category));
    } else {
      onChange([...value, category]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {value.map((category) => (
          <span
            key={category}
            className="inline-flex items-center gap-1 rounded-sm bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
          >
            {category}
            {!disabled && (
              <button
                type="button"
                onClick={() => toggle(category)}
                disabled={value.length === 1}
                aria-label={`Remove ${category}`}
                className="pressable rounded-sm text-secondary-foreground/70 hover:text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}

        {!disabled && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Edit product categories"
                className="pressable inline-flex items-center gap-1 rounded-sm border border-dashed border-input px-2 py-1 text-xs font-medium text-muted-foreground pressable hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Edit
                <ChevronsUpDown className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56" aria-label="Edit product categories">
              <div role="group" aria-label="Product categories" className="flex flex-col gap-1">
                {PRODUCT_CATEGORIES.map((category) => {
                  const selected = value.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => toggle(category)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm pressable hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected && "font-medium",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input",
                          selected && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                      {category}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
