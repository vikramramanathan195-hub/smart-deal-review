import { cn } from "@/lib/utils";

/** One segment per line item: green once the rep has decided it, amber while
 * a proposal sits with a manager, grey until then. Reads at a glance how far
 * along a deal is, which a "2 of 3" label alone doesn't. */
export function ProgressSegments({
  total,
  decided,
  inReview,
  size = "sm",
  className,
}: {
  total: number;
  decided: number;
  inReview: number;
  size?: "sm" | "md";
  className?: string;
}) {
  if (total <= 0) return null;
  const shown = Math.min(total, 12);
  const segments = Array.from({ length: shown }, (_, i) => {
    const scaled = (i / shown) * total;
    if (scaled < decided) return "decided";
    if (scaled < decided + inReview) return "review";
    return "open";
  });
  return (
    <span
      role="img"
      aria-label={`${decided} of ${total} lines decided${inReview > 0 ? `, ${inReview} in review` : ""}`}
      className={cn("inline-flex items-center gap-1", className)}
    >
      {segments.map((s, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full transition-colors duration-300",
            size === "sm" ? "h-1.5 w-3" : "h-2 w-4",
            s === "decided" ? "bg-success" : s === "review" ? "bg-warning" : "bg-muted",
          )}
        />
      ))}
    </span>
  );
}
