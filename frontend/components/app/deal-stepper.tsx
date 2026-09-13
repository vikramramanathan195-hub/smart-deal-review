import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type DealStage = "build" | "decide" | "policy" | "approval" | "send";

type Step = { key: DealStage; label: string; hint: string };

/** Where a deal is in its life, in one row: build lines, decide each one,
 * clear policy, get approval if the ceiling was crossed, send the quote.
 * The approval step only appears when the deal actually needs it, so a
 * clean deal shows a four-step path and never a step it will skip. */
export function DealStepper({
  hasLines,
  allDecided,
  inReview,
  exceeds,
  approvalState,
  sent,
  className,
}: {
  hasLines: boolean;
  allDecided: boolean;
  inReview: number;
  exceeds: boolean;
  approvalState: "pending" | "approved" | "rejected" | null;
  sent: boolean;
  className?: string;
}) {
  const steps: Step[] = [
    { key: "build", label: "Build", hint: "Add line items" },
    { key: "decide", label: "Decide", hint: "Accept or adjust each line" },
    { key: "policy", label: "Policy", hint: "Blended discount vs. ceiling" },
    ...(exceeds ? [{ key: "approval" as const, label: "Approval", hint: "Manager sign-off" }] : []),
    { key: "send", label: "Send", hint: "Quote to the customer" },
  ];

  const done: Record<DealStage, boolean> = {
    build: hasLines,
    decide: hasLines && allDecided && inReview === 0,
    policy: hasLines && allDecided && inReview === 0 && (!exceeds || approvalState === "approved"),
    approval: approvalState === "approved",
    send: sent,
  };
  const currentIndex = sent ? steps.length : steps.findIndex((s) => !done[s.key]);

  return (
    <ol
      aria-label="Deal progress"
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-3", className)}
    >
      {steps.map((step, i) => {
        const isDone = done[step.key];
        const isCurrent = i === currentIndex;
        const isRejected = step.key === "approval" && approvalState === "rejected";
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              aria-current={isCurrent ? "step" : undefined}
              title={step.hint}
              className={cn(
                "inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium transition-colors",
                isDone && "text-success",
                isCurrent && !isDone && "bg-secondary text-foreground",
                !isDone && !isCurrent && "text-muted-foreground",
                isRejected && "text-warning",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  isDone
                    ? "bg-success text-success-foreground"
                    : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  isRejected && "bg-warning text-warning-foreground",
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {step.label}
              {isRejected && <span className="text-xs font-normal">(changes requested)</span>}
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn("h-px w-6 rounded-full", isDone ? "bg-success" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
