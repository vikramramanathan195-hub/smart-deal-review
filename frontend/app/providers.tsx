"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { SessionProvider } from "@/lib/session";
import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/components/app/command-palette";
import { KeyboardShortcuts } from "@/components/app/keyboard-shortcuts";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          {children}
          <Toaster />
          <CommandPalette />
          <KeyboardShortcuts />
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
