import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Health · Deal Discount Review",
  description:
    "Live operational health for Deal Discount Review: concurrent users, response time, error rate, uptime, and request volume.",
  openGraph: {
    title: "System Health · Deal Discount Review",
    description: "Live service metrics and request volume for the discount review tool.",
  },
};

export default function HealthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
