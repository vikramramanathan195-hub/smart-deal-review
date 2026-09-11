"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-6">
        <Link href="/deals" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <LogoMark />
          <span className="text-[15px] font-semibold tracking-tight">Deal Discount Review</span>
        </Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {[
            { to: "/deals", label: "Deal Review" },
            { to: "/health", label: "System Health" },
          ].map((item) => (
            <Link
              key={item.to}
              href={item.to}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground ${
                pathname === item.to ? "bg-muted text-foreground" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">{right}</div>
      </div>
    </header>
  );
}
