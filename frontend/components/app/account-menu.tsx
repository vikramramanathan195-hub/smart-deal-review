"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Repeat } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LOGIN_EMAIL } from "@/lib/api";
import { useLoginMutation } from "@/lib/queries";
import { ROLE_LABEL, useSession } from "@/lib/session";
import type { Role } from "@/lib/api-types";

const OTHER_ROLE: Record<Role, Role> = {
  sales_rep: "manager",
  manager: "sales_rep",
};

/** Account dropdown in the top nav: shows who's signed in, and lets you
 * switch between the two seeded demo roles or sign out — internal tool,
 * so this intentionally stays a couple of menu items rather than a full
 * account/user-management surface. */
export function AccountMenu() {
  const { email, role, signIn, signOut } = useSession();
  const router = useRouter();
  const loginMutation = useLoginMutation();

  if (!role || !email) return null;

  const otherRole = OTHER_ROLE[role];

  const handleSwitchRole = () => {
    loginMutation.mutate(
      { email: ROLE_LOGIN_EMAIL[otherRole], role: otherRole },
      {
        onSuccess: (data) => {
          signIn(data.accessToken, data.email, data.role);
          // Stay on the same deal: a manager switching in to review what a
          // rep just proposed shouldn't be dropped onto a different deal.
          const here = `${window.location.pathname}${window.location.search}`;
          router.push(here === "/sign-in" ? "/" : here);
          toast.success(`Now viewing as ${ROLE_LABEL[data.role]}`);
        },
        onError: (error) => {
          toast.error("Couldn't switch role", { description: error.message });
        },
      },
    );
  };

  useEffect(() => {
    const onSwitchRequest = () => handleSwitchRole();
    document.addEventListener("role:switch", onSwitchRequest);
    return () => document.removeEventListener("role:switch", onSwitchRequest);
  });

  const handleSignOut = () => {
    signOut();
    router.push("/sign-in");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground pressable hover:bg-muted"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-ai" />
          {ROLE_LABEL[role]}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="label-caps">
            Signed in as
          </p>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSwitchRole} disabled={loginMutation.isPending}>
          <Repeat className="mr-2 h-4 w-4" />
          Switch to {ROLE_LABEL[otherRole]}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
