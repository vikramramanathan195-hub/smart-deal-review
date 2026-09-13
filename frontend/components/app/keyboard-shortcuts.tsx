"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/session";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function dialogIsOpen(): boolean {
  return document.querySelector('[role="dialog"][data-state="open"]') !== null;
}

const GROUPS: { title: string; rows: { keys: string[][]; label: string }[] }[] = [
  {
    title: "Navigation",
    rows: [
      { keys: [["⌘", "K"]], label: "Command palette" },
      { keys: [["G"], ["H"]], label: "Go to Home" },
      { keys: [["G"], ["D"]], label: "Go to Deal Review" },
      { keys: [["G"], ["S"]], label: "Go to System Health" },
      { keys: [["/"]], label: "Search deals (on Home)" },
    ],
  },
  {
    title: "Actions",
    rows: [
      { keys: [["N"]], label: "New deal" },
      { keys: [["T"]], label: "Toggle light / dark" },
      { keys: [["?"]], label: "Show this sheet" },
    ],
  },
  {
    title: "While editing",
    rows: [
      { keys: [["↑ / ↓"]], label: "Nudge a deal value by 1,000, or a discount by 0.5" },
      { keys: [["⇧", "↑ / ↓"]], label: "Bigger step: 10,000, or 1 pt" },
      { keys: [["↵"]], label: "Save or submit" },
      { keys: [["Esc"]], label: "Cancel" },
    ],
  },
];

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-border bg-secondary px-2 font-sans text-xs font-semibold text-foreground">
      {children}
    </kbd>
  );
}

/** Single-key shortcuts for people who live in the app. Every one is ignored
 * while typing in a field or while any dialog is open, so they never fight
 * the thing the user is actually doing. */
export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { isSignedIn, role } = useSession();
  const chordRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target) || dialogIsOpen()) return;

      const key = e.key;
      const chord = chordRef.current;
      chordRef.current = null;

      if (chord && chord.key === "g" && Date.now() - chord.at < 900) {
        const path = { h: "/", d: "/deals", s: "/health" }[key.toLowerCase()];
        if (path) {
          e.preventDefault();
          router.push(path);
          return;
        }
      }

      switch (key) {
        case "?":
          e.preventDefault();
          setOpen(true);
          return;
        case "/": {
          e.preventDefault();
          const search = document.querySelector<HTMLInputElement>('[data-shortcut="search"]');
          if (search) search.focus();
          else document.dispatchEvent(new CustomEvent("command-palette:open"));
          return;
        }
        case "n":
        case "N": {
          if (role !== "sales_rep") return;
          e.preventDefault();
          if (window.location.pathname === "/") {
            document.dispatchEvent(new CustomEvent("new-deal:open"));
          } else {
            router.push("/?new=1");
          }
          return;
        }
        case "t":
        case "T":
          e.preventDefault();
          setTheme(resolvedTheme === "dark" ? "light" : "dark");
          return;
        case "g":
        case "G":
          chordRef.current = { key: "g", at: Date.now() };
          return;
      }
    }

    function onOpenRequest() {
      setOpen(true);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("shortcuts:open", onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("shortcuts:open", onOpenRequest);
    };
  }, [isSignedIn, role, router, resolvedTheme, setTheme]);

  if (!isSignedIn) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts stay out of the way while you are typing in a field.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group.title} className={group.title === "While editing" ? "sm:col-span-2" : ""}>
              <p className="label-caps">{group.title}</p>
              <ul className="mt-3 space-y-2">
                {group.rows.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {row.keys.map((combo, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="px-1 text-xs text-muted-foreground">then</span>}
                          {combo.map((k) => (
                            <Key key={k}>{k}</Key>
                          ))}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
