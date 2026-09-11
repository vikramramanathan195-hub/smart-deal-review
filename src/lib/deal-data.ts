export type Role = "Sales Rep" | "Manager";

export const PRODUCT_CATEGORIES = ["Compute", "Storage", "Networking", "Services"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type Confidence = "high" | "medium" | "low";

export type Factor = { name: string; value: number };

export type CustomerContext = {
  name: string;
  partnerSince: number;
  lifetimeValue: string;
  renewalRate: string;
  avgDiscount: number;
  history: { date: string; discount: number; outcome: "Won" | "Lost" }[];
  callout: string;
};

export type Recommendation = {
  discount: number;
  confidence: Confidence;
  factors: Factor[];
  customer: CustomerContext;
};

export type LineItem = {
  id: string;
  category: ProductCategory | "";
  value: number | "";
  decision: "pending" | "accepted" | "adjusted" | "overridden";
  appliedDiscount: number | null;
  generating: boolean;
  recommendation: Recommendation | null;
};

let counter = 0;
export const newId = () => `line-${Date.now()}-${counter++}`;

const northwind: CustomerContext = {
  name: "Northwind Industries",
  partnerSince: 2022,
  lifetimeValue: "$1.24M",
  renewalRate: "100%",
  avgDiscount: 10.7,
  history: [
    { date: "Mar 2023", discount: 9.0, outcome: "Won" },
    { date: "Sep 2023", discount: 11.5, outcome: "Won" },
    { date: "Feb 2024", discount: 14.0, outcome: "Lost" },
    { date: "Nov 2024", discount: 8.5, outcome: "Won" },
  ],
  callout: "1.3 pts above their historical average — still within policy.",
};

const baseFactors: Factor[] = [
  { name: "Baseline (segment: Enterprise)", value: 8.0 },
  { name: "Customer tenure (4 yrs)", value: 2.5 },
  { name: "Deal size tier", value: 2.0 },
  { name: "Regional competitive pressure", value: 1.5 },
  { name: "Margin floor guardrail", value: -2.0 },
];

const storageFactors: Factor[] = [
  { name: "Baseline (segment: Enterprise)", value: 8.0 },
  { name: "Customer tenure (4 yrs)", value: 2.5 },
  { name: "Deal size tier", value: 1.0 },
  { name: "Regional competitive pressure", value: 2.5 },
  { name: "Margin floor guardrail", value: -1.5 },
];

const servicesFactors: Factor[] = [
  { name: "Baseline (segment: Enterprise)", value: 8.0 },
  { name: "Customer tenure (4 yrs)", value: 2.5 },
  { name: "Deal size tier", value: 3.0 },
  { name: "Regional competitive pressure", value: 4.0 },
  { name: "Margin floor guardrail", value: -2.5 },
];

export const seedLineItems: LineItem[] = [
  {
    id: "line-seed-1",
    category: "Compute",
    value: 180000,
    decision: "pending",
    appliedDiscount: null,
    generating: false,
    recommendation: {
      discount: 12,
      confidence: "high",
      factors: baseFactors,
      customer: northwind,
    },
  },
  {
    id: "line-seed-2",
    category: "Storage",
    value: 96500,
    decision: "pending",
    appliedDiscount: null,
    generating: false,
    recommendation: {
      discount: 12.5,
      confidence: "medium",
      factors: storageFactors,
      customer: {
        ...northwind,
        avgDiscount: 10.7,
        callout: "1.8 pts above their historical average — flagged for manager review.",
      },
    },
  },
  {
    id: "line-seed-3",
    category: "Services",
    value: 42000,
    decision: "pending",
    appliedDiscount: null,
    generating: false,
    recommendation: {
      discount: 15,
      confidence: "low",
      factors: servicesFactors,
      customer: {
        ...northwind,
        callout: "4.3 pts above their historical average — justify with competitive evidence.",
      },
    },
  },
];

/** Deterministic mock "AI" generation for newly added lines. */
export function generateRecommendation(category: ProductCategory | "", value: number): Recommendation {
  const sizeTier = value >= 250000 ? 3 : value >= 100000 ? 2 : value >= 50000 ? 1.5 : 1;
  const pressure = category === "Services" ? 4 : category === "Networking" ? 3 : 1.5;
  const factors: Factor[] = [
    { name: "Baseline (segment: Enterprise)", value: 8.0 },
    { name: "Customer tenure (4 yrs)", value: 2.5 },
    { name: "Deal size tier", value: sizeTier },
    { name: "Regional competitive pressure", value: pressure },
    { name: "Margin floor guardrail", value: -2.0 },
  ];
  const discount = Math.round(factors.reduce((s, f) => s + f.value, 0) * 10) / 10;
  const confidence: Confidence = discount <= 12 ? "high" : discount <= 14 ? "medium" : "low";
  return { discount, confidence, factors, customer: northwind };
}

export const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

export function effectiveDiscount(line: LineItem): number {
  if (line.appliedDiscount !== null) return line.appliedDiscount;
  return line.recommendation?.discount ?? 0;
}

export type PolicyStatus = "within" | "review" | "exceeds";

export function policyStatus(blended: number): {
  status: PolicyStatus;
  label: string;
  note: string;
} {
  if (blended <= 12)
    return {
      status: "within",
      label: "Within Range",
      note: "This blended discount sits inside the standard Enterprise band. No approval required — the rep can close it directly.",
    };
  if (blended <= 15)
    return {
      status: "review",
      label: "Needs Review",
      note: "Slightly above the standard band. A manager should review the reasoning before this deal is sent to the customer.",
    };
  return {
    status: "exceeds",
    label: "Exceeds Policy",
    note: "This blended discount is above the 15% policy ceiling. Manager approval with written justification is required.",
  };
}
