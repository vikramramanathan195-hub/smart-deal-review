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
  Region,
  Role,
  TermLength,
} from "@/lib/api-types";

import type {
  DiscountRecommendation,
  LineItem,
  ProductCategory,
  Region,
  TermLength,
} from "@/lib/api-types";
import { regionInfo } from "@/lib/fx-rates";

export const PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  "Compute",
  "Storage",
  "Networking",
  "Services",
];

export const TERM_LENGTHS: readonly TermLength[] = ["12mo", "24mo", "36mo"];
export const TERM_LENGTH_LABEL: Record<TermLength, string> = {
  "12mo": "12 months",
  "24mo": "24 months",
  "36mo": "36 months",
};

// Always USD, regardless of the deal's own region — used for the small
// "≈ $X USD" equivalents so figures in different currencies stay comparable.
export const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Formats an amount in a deal's own native currency/locale — e.g. a
 * Eurozone deal renders "€248.000" (de-DE grouping), not "$248,000". */
export const formatMoney = (n: number, region: Region) => {
  const { currencyCode, locale } = regionInfo(region);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(n);
};

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
