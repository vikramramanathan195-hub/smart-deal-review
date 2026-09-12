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
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((category) => (
          <span
            key={category}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
          >
            {category}
            {!disabled && (
              <button
                type="button"
                onClick={() => toggle(category)}
                disabled={value.length === 1}
                aria-label={`Remove ${category}`}
                className="rounded-full text-accent-foreground/70 transition-colors hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
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
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-input px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-ai hover:text-ai focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Edit
                <ChevronsUpDown className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <ul role="listbox" aria-multiselectable="true" className="flex flex-col gap-0.5">
                {PRODUCT_CATEGORIES.map((category) => {
                  const selected = value.includes(category);
                  return (
                    <li key={category}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => toggle(category)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                          selected && "font-medium",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input",
                            selected && "border-ai bg-ai text-ai-foreground",
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                        {category}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
