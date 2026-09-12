"use client";

import { POLICY_CEILING_PCT } from "@/lib/deal-data";
import { cn } from "@/lib/utils";

/** The blended discount drawn against the policy ceiling, so "how close is
 * this deal to needing approval" is readable at a glance instead of only as
 * a number next to a badge. Two colors only — within or over — matching the
 * backend's two-band status, so the gauge never implies a third tier the
 * approval actions don't actually have. */
export function PolicyGauge({
  value,
  size = "md",
  showHeadroom = true,
  className,
}: {
  value: number;
  size?: "sm" | "md";
  showHeadroom?: boolean;
  className?: string;
}) {
  const max = Math.max(25, Math.ceil((value + 5) / 5) * 5);
  const fillPct = Math.min(100, Math.max(0, (value / max) * 100));
  const ceilingPct = (POLICY_CEILING_PCT / max) * 100;
  const exceeds = value > POLICY_CEILING_PCT;
  const delta = Math.abs(POLICY_CEILING_PCT - value);
  const headroomText = exceeds
    ? `${delta.toFixed(1)} pts over the ${POLICY_CEILING_PCT}% ceiling`
    : `${delta.toFixed(1)} pts of headroom under the ${POLICY_CEILING_PCT}% ceiling`;

  return (
    <div className={cn("w-full", className)}>
      <div
        role="meter"
        aria-label="Blended discount against policy ceiling"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * 10) / 10}
        aria-valuetext={`${value.toFixed(1)}% — ${headroomText}`}
        className={cn(
          "relative w-full overflow-visible rounded-full bg-muted",
          size === "sm" ? "h-1.5" : "h-2.5",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            exceeds ? "bg-danger" : "bg-success",
          )}
          style={{ width: `${fillPct}%` }}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/70",
            size === "sm" ? "h-3" : "h-5",
          )}
          style={{ left: `${ceilingPct}%` }}
        />
      </div>

      {size === "md" && (
        <div className="relative mt-1.5 h-4 text-[11px] font-medium text-muted-foreground">
          <span className="absolute left-0">0%</span>
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-foreground"
            style={{ left: `${ceilingPct}%` }}
          >
            {POLICY_CEILING_PCT}% ceiling
          </span>
          <span className="absolute right-0">{max}%</span>
        </div>
      )}

      {size === "md" && showHeadroom && (
        <p
          className={cn(
            "mt-1.5 text-xs font-medium",
            exceeds ? "text-danger" : "text-success",
          )}
        >
          {headroomText}
        </p>
      )}
    </div>
  );
}
