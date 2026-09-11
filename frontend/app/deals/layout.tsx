import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deal Review · Deal Discount Review",
  description:
    "Build multi-line deals, review AI-suggested discounts per line with full reasoning, and check the blended discount against pricing policy.",
  openGraph: {
    title: "Deal Review · Deal Discount Review",
    description: "Per-line AI discount recommendations with reasoning and policy checks.",
  },
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
