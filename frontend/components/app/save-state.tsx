"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "pending" | "saving" | "saved";

/** Small inline indicator for autosaving fields: shows an unsaved dot while
 * a debounce is pending, a spinner while the request is in flight, and a
 * checkmark that fades after a save completes — so edits never look silently
 * dropped, without needing an explicit Save button. */
export function SaveStateIndicator({ state, className }: { state: SaveState; className?: string }) {
  if (state === "idle") return null;

  return (
    <span
      role="status"
      className={cn(
        "animate-in fade-in inline-flex items-center gap-1 text-xs font-medium duration-200",
        state === "pending" && "text-muted-foreground",
        state === "saving" && "text-muted-foreground",
        state === "saved" && "text-success",
        className,
      )}
    >
      {state === "pending" && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
          Unsaved
        </>
      )}
      {state === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="h-3 w-3" aria-hidden="true" />
          Saved
        </>
      )}
    </span>
  );
}
