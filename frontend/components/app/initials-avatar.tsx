import { cn } from "@/lib/utils";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : (words[0]?.[1] ?? "");
  return (first + second).toUpperCase();
}

/** Neutral monogram so a customer has a face in lists and headers. Deliberately
 * uncolored: the palette is reserved for AI and status. */
export function InitialsAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold tracking-wide text-foreground",
        size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
