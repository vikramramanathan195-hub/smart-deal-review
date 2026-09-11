export type {
  ApprovalState,
  Confidence,
  Customer,
  Deal,
  DealDetail,
  DealStatus,
  DealSummary,
  DiscountHistoryEntry,
  DiscountRecommendation,
  Factor,
  LineItem,
  LineItemDecision,
  LineItemDetail,
  Outcome,
  ProductCategory,
  Role,
  TermLength,
} from "@/lib/api-types";

import type { DiscountRecommendation, LineItem, ProductCategory } from "@/lib/api-types";

export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  "Compute",
  "Storage",
  "Networking",
  "Services",
];

export const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** The discount actually in effect for a line: the rep's applied override if
 * set, otherwise the AI's recommended figure. */
export function effectiveDiscount(
  lineItem: LineItem,
  recommendation: DiscountRecommendation,
): number {
  return lineItem.appliedDiscountPct ?? recommendation.recommendedPct;
}

export type PolicyStatus = "within" | "exceeds";

/** Read of the blended discount for the summary banner. Matches the
 * backend's own two-band `status` field exactly (within_range /
 * needs_approval) at the 15% approval threshold — there is no separate
 * "advisory" middle tier, since that previously showed a "Needs Review"
 * badge while the actual Approve/Request Changes actions stayed disabled,
 * which read as contradictory. */
export function policyStatus(blended: number): {
  status: PolicyStatus;
  label: string;
  note: string;
} {
  if (blended <= 15)
    return {
      status: "within",
      label: "Within Range",
      note: "This blended discount is within the 15% policy ceiling. No approval required — the rep can close it directly.",
    };
  return {
    status: "exceeds",
    label: "Exceeds Policy",
    note: "This blended discount is above the 15% policy ceiling. Manager approval with written justification is required.",
  };
}
