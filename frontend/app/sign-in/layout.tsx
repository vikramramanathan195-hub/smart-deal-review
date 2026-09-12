import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In · Deal Discount Review",
  description:
    "Sign in to Deal Discount Review to build multi-line deals, review AI discount recommendations, and check deals against pricing policy.",
  openGraph: {
    title: "Sign In · Deal Discount Review",
    description: "Internal discount review tool for sales reps and approving managers.",
  },
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
