"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "ddr:intro-dismissed";

/** One-line orientation for a first visit to Deal Review. Dismissed once,
 * remembered per browser, never shown to managers (they aren't building). */
export function IntroStrip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Fine to show again next time.
    }
  };

  const steps = [
    "Enter each line item",
    "Review the AI recommendation for each one",
    "Check the whole deal against policy",
  ];

  return (
    <div className="animate-in fade-in flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-secondary/60 px-4 py-3 text-sm duration-300">
      <p className="label-caps">How this works</p>
      <ol className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-card text-xs font-semibold shadow-card">
              {i + 1}
            </span>
            <span className="text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="pressable ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
