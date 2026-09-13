"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/app/theme-toggle";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      D
    </span>
  );
}

export function TopNav({ right }: { right?: ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur transition-shadow duration-200 ${
        scrolled ? "shadow-card" : ""
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-6">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <LogoMark />
          <span className="whitespace-nowrap text-sm font-semibold tracking-tight">
            Deal Discount Review
          </span>
        </Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {[
            { to: "/", label: "Home" },
            { to: "/deals", label: "Deal Review" },
            { to: "/health", label: "System Health" },
          ].map((item) => (
            <Link
              key={item.to}
              href={item.to}
              className={`pressable rounded-md px-3 py-2 text-sm font-medium hover:bg-muted hover:text-foreground ${
                pathname === item.to ? "bg-muted text-foreground" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => document.dispatchEvent(new CustomEvent("command-palette:open"))}
            className="pressable hidden items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
          >
            <Search className="h-3.5 w-3.5" />
            Search
            <kbd className="ml-1 rounded-sm border border-border bg-card px-1 font-sans text-xs font-semibold leading-none">
              ⌘K
            </kbd>
          </button>
          <ThemeToggle />
          {right}
        </div>
      </div>
    </header>
  );
}
