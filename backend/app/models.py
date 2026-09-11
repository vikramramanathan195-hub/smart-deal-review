from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Role = Literal["sales_rep", "manager"]
Confidence = Literal["low", "medium", "high"]
DealStatus = Literal["within_range", "needs_approval"]
ApprovalState = Literal["pending", "approved", "rejected"] | None
Outcome = Literal["won", "lost"]
LineItemDecision = Literal["pending", "accepted", "adjusted", "overridden"]
ProductCategory = Literal["Compute", "Storage", "Networking", "Services"]


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


class LineItem(CamelModel):
    id: str
    deal_id: str
    product_category: ProductCategory
    deal_value: float = Field(gt=0)
    applied_discount_pct: float | None = Field(default=None, ge=0, le=100)
    decision: LineItemDecision = "pending"


class LineItemDetail(CamelModel):
    line_item: LineItem
    recommendation: DiscountRecommendation


class Deal(CamelModel):
    id: str
    name: str
    term_length: Literal["12mo", "24mo", "36mo"]
    product_categories: list[ProductCategory]
    sample_deal_key: str
    status: DealStatus
    approval_state: ApprovalState = None


class DealSummary(CamelModel):
    id: str
    name: str
    status: DealStatus


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
    action: Literal["accept", "adjust", "override"]
    applied_discount_pct: float | None = Field(default=None, ge=0, le=100)


class ApprovalRequest(CamelModel):
    decision: Literal["approved", "rejected"]
    note: str | None = None


class ApprovalResponse(CamelModel):
    deal_id: str
    status: DealStatus
    approval_state: ApprovalState
