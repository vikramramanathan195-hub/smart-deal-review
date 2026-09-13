"use client";

import { cn } from "@/lib/utils";

/** A radiogroup styled as a segmented control. Only the selected segment is
 * tabbable; arrow keys move the selection, so it costs one Tab stop instead
 * of one per option and never needs a dropdown to reveal three choices. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
  className,
  ...aria
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode }[];
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
    if (!forward && !backward) return;
    e.preventDefault();
    const next = options[(index + (forward ? 1 : options.length - 1)) % options.length];
    if (next) {
      onChange(next.value);
      const el = (e.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(
        `[data-value="${next.value}"]`,
      );
      el?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      {...aria}
      onKeyDown={onKeyDown}
      className={cn("inline-flex rounded-md bg-secondary p-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-value={option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "pressable flex-1 whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
