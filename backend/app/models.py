from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Role = Literal["sales_rep", "manager"]
Confidence = Literal["low", "medium", "high"]
DealStatus = Literal["within_range", "needs_approval"]
ApprovalState = Literal["pending", "approved", "rejected"] | None
Outcome = Literal["won", "lost"]
LineItemDecision = Literal["pending", "accepted", "adjusted", "overridden"]
# Gate on the *line item* itself — separate from the rep's decision label above.
# "none": nothing awaiting a manager. "pending_approval": a proposed discount
# outside the auto-approve band is awaiting a manager's approve/reject.
LineApprovalState = Literal["none", "pending_approval", "approved", "rejected"]
ProductCategory = Literal["Compute", "Storage", "Networking", "Services"]
TermLength = Literal["12mo", "24mo", "36mo"]
# Each region implies a native currency/locale on the frontend (see
# frontend/lib/fx-rates.ts) — the backend just stores which one a deal is in.
Region = Literal["north_america", "uk", "eurozone", "japan", "india", "brazil"]
DiscountChangeAction = Literal[
    "accepted", "proposed_auto_applied", "proposed_pending_approval", "approved", "rejected"
]


class CamelModel(BaseModel):
    """Base for every API model: fields are snake_case in Python, camelCase on
    the wire. populate_by_name=True lets requests send either form."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Factor(CamelModel):
    name: str
    contribution_pct: float
    positive: bool


class DiscountRecommendation(CamelModel):
    line_item_id: str
    recommended_pct: float
    confidence: Confidence
    net_value: float
    factors: list[Factor]


class DiscountHistoryEntry(CamelModel):
    customer_id: str
    date: str
    discount_pct: float
    outcome: Outcome


class Customer(CamelModel):
    id: str
    name: str
    partner_since: int
    lifetime_value: str
    renewal_rate_pct: float
    avg_discount_pct: float


class DiscountChangeEntry(CamelModel):
    at: str
    by: str
    previous_pct: float | None
    new_pct: float | None
    reason: str | None
    action: DiscountChangeAction


class LineItem(CamelModel):
    id: str
    deal_id: str
    product_category: ProductCategory
    deal_value: float = Field(gt=0)
    # The value actually counted toward the deal's blended discount. Stays put
    # while a proposal is pending_approval — only a manager's approval moves it.
    applied_discount_pct: float | None = Field(default=None, ge=0, le=100)
    decision: LineItemDecision = "pending"
    line_approval_state: LineApprovalState = "none"
    # Set while line_approval_state == "pending_approval"; the number a manager
    # is being asked to approve or reject.
    pending_discount_pct: float | None = Field(default=None, ge=0, le=100)
    # Reason behind the most recent proposal (pending, approved, or rejected).
    override_reason: str | None = None
    decided_by: str | None = None
    history: list[DiscountChangeEntry] = Field(default_factory=list)


class LineItemDetail(CamelModel):
    line_item: LineItem
    recommendation: DiscountRecommendation


class Deal(CamelModel):
    id: str
    name: str
    term_length: TermLength
    product_categories: list[ProductCategory]
    sample_deal_key: str
    status: DealStatus
    approval_state: ApprovalState = None
    # What the manager said when approving or sending the deal back, so the
    # rep sees the reason on the deal rather than a bare "changes requested".
    approval_note: str | None = None
    region: Region = "north_america"


class DealSummary(CamelModel):
    id: str
    name: str
    status: DealStatus
    approval_state: ApprovalState = None
    deal_value_total: float
    blended_discount_pct: float
    region: Region
    customer_name: str
    line_item_count: int
    # Lines the rep has settled vs. lines sitting with a manager, so the
    # dashboard can say how far along a deal is without opening it.
    decided_line_count: int
    in_review_line_count: int
    term_length: TermLength
    product_categories: list[ProductCategory]


class DealCreate(CamelModel):
    name: str = Field(min_length=1)
    customer_name: str = Field(min_length=1)
    term_length: TermLength = "12mo"
    region: Region = "north_america"
    product_categories: list[ProductCategory] = Field(min_length=1)


class DealUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1)
    region: Region | None = None
    product_categories: list[ProductCategory] | None = None
    term_length: TermLength | None = None


class DealDetail(CamelModel):
    deal: Deal
    line_items: list[LineItemDetail]
    customer: Customer
    discount_history: list[DiscountHistoryEntry]
    blended_discount_pct: float


# --- request/response bodies ---


class LoginRequest(CamelModel):
    email: str
    role: Role


class LoginResponse(CamelModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    role: Role
    email: str


class LineItemCreate(CamelModel):
    product_category: ProductCategory
    deal_value: float = Field(gt=0)


class LineItemUpdate(CamelModel):
    product_category: ProductCategory | None = None
    deal_value: float | None = Field(default=None, gt=0)


class LineItemDecisionRequest(CamelModel):
    action: Literal["accept", "propose"]
    applied_discount_pct: float | None = Field(default=None, ge=0, le=100)
    # Required for "propose" — every manually-entered discount needs one, not
    # just ones outside the auto-approve band. Enforced in the route so the
    # error is field-level.
    reason: str | None = None


class LineItemApprovalRequest(CamelModel):
    decision: Literal["approved", "rejected"]


class ApprovalRequest(CamelModel):
    decision: Literal["approved", "rejected"]
    note: str | None = None


class ApprovalResponse(CamelModel):
    deal_id: str
    status: DealStatus
    approval_state: ApprovalState
