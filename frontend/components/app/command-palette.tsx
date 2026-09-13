"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  FileText,
  Keyboard,
  LayoutGrid,
  LogOut,
  Moon,
  Plus,
  Repeat,
  Sun,
} from "lucide-react";
import { ROLE_LABEL } from "@/lib/session";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandInput,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useDealsQuery } from "@/lib/queries";
import { policyStatus } from "@/lib/deal-data";
import { useSession } from "@/lib/session";

/** Cmd/Ctrl+K command palette: jump to any page or deal, or flip the theme,
 * without leaving the keyboard. Deal list is fetched lazily only while the
 * palette is open so it costs nothing on pages that never open it. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { isSignedIn, signOut, role } = useSession();
  const dealsQuery = useDealsQuery();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("command-palette:open", onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("command-palette:open", onOpenRequest);
    };
  }, []);

  if (!isSignedIn) return null;

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search deals, pages, and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => go("/")}>
            <LayoutGrid />
            Home
          </CommandItem>
          <CommandItem onSelect={() => go("/deals")}>
            <FileText />
            Deal Review
          </CommandItem>
          <CommandItem onSelect={() => go("/health")}>
            <Activity />
            System Health
          </CommandItem>
        </CommandGroup>

        {dealsQuery.data && dealsQuery.data.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Deals">
              {dealsQuery.data.map((deal) => {
                const policy = policyStatus(deal.blendedDiscountPct);
                return (
                  <CommandItem key={deal.id} onSelect={() => go(`/deals?deal=${deal.id}`)}>
                    <FileText />
                    {deal.name}
                    <CommandShortcut>{policy.label}</CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Actions">
          {role === "sales_rep" && (
            <CommandItem onSelect={() => go("/?new=1")}>
              <Plus />
              New deal
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem
            onSelect={() => {
              setOpen(false);
              document.dispatchEvent(new CustomEvent("role:switch"));
            }}
          >
            <Repeat />
            Switch to {ROLE_LABEL[role === "manager" ? "sales_rep" : "manager"]}
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            {resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              document.dispatchEvent(new CustomEvent("shortcuts:open"));
            }}
          >
            <Keyboard />
            Keyboard shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              signOut();
              router.push("/sign-in");
            }}
          >
            <LogOut />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>
          <kbd className="font-sans font-semibold text-foreground">↑↓</kbd> navigate
        </span>
        <span>
          <kbd className="font-sans font-semibold text-foreground">↵</kbd> select
        </span>
        <span>
          <kbd className="font-sans font-semibold text-foreground">esc</kbd> close
        </span>
        <span className="ml-auto">
          <kbd className="font-sans font-semibold text-foreground">?</kbd> all shortcuts
        </span>
      </div>
    </CommandDialog>
  );
}
