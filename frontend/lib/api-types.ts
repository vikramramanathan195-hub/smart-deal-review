// Mirrors backend/app/models.py exactly (camelCase on the wire). No adapter
// layer — these are the types the API actually returns.

export type Role = "sales_rep" | "manager";
export type Confidence = "low" | "medium" | "high";
export type DealStatus = "within_range" | "needs_approval";
export type ApprovalState = "pending" | "approved" | "rejected" | null;
export type Outcome = "won" | "lost";
export type LineItemDecision = "pending" | "accepted" | "adjusted" | "overridden";
export type LineApprovalState = "none" | "pending_approval" | "approved" | "rejected";
export type ProductCategory = "Compute" | "Storage" | "Networking" | "Services";
export type TermLength = "12mo" | "24mo" | "36mo";
export type Region = "north_america" | "uk" | "eurozone" | "japan" | "india" | "brazil";
export type DiscountChangeAction =
  "accepted" | "proposed_auto_applied" | "proposed_pending_approval" | "approved" | "rejected";

export type Factor = {
  name: string;
  contributionPct: number;
  positive: boolean;
};

export type DiscountRecommendation = {
  lineItemId: string;
  recommendedPct: number;
  confidence: Confidence;
  netValue: number;
  factors: Factor[];
};

export type DiscountHistoryEntry = {
  customerId: string;
  date: string;
  discountPct: number;
  outcome: Outcome;
};

export type Customer = {
  id: string;
  name: string;
  partnerSince: number;
  lifetimeValue: string;
  renewalRatePct: number;
  avgDiscountPct: number;
};

export type DiscountChangeEntry = {
  at: string;
  by: string;
  previousPct: number | null;
  newPct: number | null;
  reason: string | null;
  action: DiscountChangeAction;
};

export type LineItem = {
  id: string;
  dealId: string;
  productCategory: ProductCategory;
  dealValue: number;
  appliedDiscountPct: number | null;
  decision: LineItemDecision;
  lineApprovalState: LineApprovalState;
  pendingDiscountPct: number | null;
  overrideReason: string | null;
  decidedBy: string | null;
  history: DiscountChangeEntry[];
};

export type LineItemDetail = {
  lineItem: LineItem;
  recommendation: DiscountRecommendation;
};

export type Deal = {
  id: string;
  name: string;
  termLength: TermLength;
  productCategories: ProductCategory[];
  sampleDealKey: string;
  status: DealStatus;
  approvalState: ApprovalState;
  approvalNote: string | null;
  quoteSentAt: string | null;
  quoteSentTo: string | null;
  region: Region;
};

export type SendQuoteBody = {
  recipient: string;
  subject: string;
  message?: string;
};

export type DealSummary = {
  id: string;
  name: string;
  status: DealStatus;
  approvalState: ApprovalState;
  dealValueTotal: number;
  blendedDiscountPct: number;
  region: Region;
  customerName: string;
  lineItemCount: number;
  decidedLineCount: number;
  inReviewLineCount: number;
  quoteSentAt: string | null;
  termLength: TermLength;
  productCategories: ProductCategory[];
};

export type DealUpdateBody = {
  name?: string;
  region?: Region;
  productCategories?: ProductCategory[];
  termLength?: TermLength;
};

export type DealCreateBody = {
  name: string;
  customerName: string;
  termLength: TermLength;
  region: Region;
  productCategories: ProductCategory[];
};

export type DealDetail = {
  deal: Deal;
  lineItems: LineItemDetail[];
  customer: Customer;
  discountHistory: DiscountHistoryEntry[];
  blendedDiscountPct: number;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: "bearer";
  role: Role;
  email: string;
};

export type LineItemCreateBody = {
  productCategory: ProductCategory;
  dealValue: number;
};

export type LineItemUpdateBody = {
  productCategory?: ProductCategory;
  dealValue?: number;
};

export type LineItemDecisionAction = "accept" | "propose";

export type LineItemDecisionBody = {
  action: LineItemDecisionAction;
  appliedDiscountPct?: number;
  reason?: string;
};

export type ApprovalDecision = "approved" | "rejected";

export type LineItemApprovalBody = {
  decision: ApprovalDecision;
};

export type ApprovalBody = {
  decision: ApprovalDecision;
  note?: string;
};

export type ApprovalResponse = {
  dealId: string;
  status: DealStatus;
  approvalState: ApprovalState;
};
