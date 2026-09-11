"""In-memory data store. No database — state lives in process memory and
resets on restart, consistent with the rest of this project's mocked approach."""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.models import (
    Customer,
    Deal,
    DiscountChangeEntry,
    DiscountHistoryEntry,
    DiscountRecommendation,
    LineItem,
)

# A proposal within this many points of the AI's recommendation auto-applies;
# beyond it, the line locks and waits for a manager to approve or reject it.
AUTO_APPROVE_BAND_PCT = 3.0


class LineItemLockedError(Exception):
    """Raised when an action targets a line item that's pending manager approval."""
from app.seed_data import (
    CERULEAN_CUSTOMER,
    CERULEAN_DEAL,
    CERULEAN_HISTORY,
    CERULEAN_LINE_ITEMS,
    NORTHWIND_CUSTOMER,
    NORTHWIND_DEAL,
    NORTHWIND_HISTORY,
    NORTHWIND_LINE_ITEMS,
)


class NotFoundError(Exception):
    pass


@dataclass
class DealState:
    deal: Deal
    customer: Customer
    discount_history: list[DiscountHistoryEntry]
    line_items: dict[str, LineItem] = field(default_factory=dict)
    recommendations: dict[str, DiscountRecommendation] = field(default_factory=dict)
    approval_history: list[str | None] = field(default_factory=list)


def _net_value(deal_value: float, pct: float) -> float:
    return round(deal_value * (1 - pct / 100), 2)


def generate_recommendation(line_item_id: str, category: str, value: float) -> DiscountRecommendation:
    """Deterministic mock "AI" generation, mirroring generateRecommendation() in
    frontend/src/lib/deal-data.ts."""
    size_tier = 3.0 if value >= 250_000 else 2.0 if value >= 100_000 else 1.5 if value >= 50_000 else 1.0
    pressure = 4.0 if category == "Services" else 3.0 if category == "Networking" else 1.5

    factors = [
        {"name": "Baseline (segment: Enterprise)", "contribution_pct": 8.0, "positive": True},
        {"name": "Customer tenure (4 yrs)", "contribution_pct": 2.5, "positive": True},
        {"name": "Deal size tier", "contribution_pct": size_tier, "positive": True},
        {"name": "Regional competitive pressure", "contribution_pct": pressure, "positive": True},
        {"name": "Margin floor guardrail", "contribution_pct": -2.0, "positive": False},
    ]
    discount = round(sum(f["contribution_pct"] for f in factors) * 10) / 10
    confidence = "high" if discount <= 12 else "medium" if discount <= 14 else "low"

    return DiscountRecommendation(
        line_item_id=line_item_id,
        recommended_pct=discount,
        confidence=confidence,
        net_value=_net_value(value, discount),
        factors=factors,
    )


class DataStore:
    def __init__(self) -> None:
        self.deals: dict[str, DealState] = {}
        self._seed()

    def _seed(self) -> None:
        for deal, customer, history, line_item_specs in (
            (NORTHWIND_DEAL, NORTHWIND_CUSTOMER, NORTHWIND_HISTORY, NORTHWIND_LINE_ITEMS),
            (CERULEAN_DEAL, CERULEAN_CUSTOMER, CERULEAN_HISTORY, CERULEAN_LINE_ITEMS),
        ):
            state = DealState(
                deal=deal.model_copy(deep=True),
                customer=customer.model_copy(deep=True),
                discount_history=[h.model_copy() for h in history],
            )
            for line_item_id, category, value, recommended_pct, confidence, factors in line_item_specs:
                state.line_items[line_item_id] = LineItem(
                    id=line_item_id,
                    deal_id=deal.id,
                    product_category=category,
                    deal_value=value,
                    applied_discount_pct=None,
                    decision="pending",
                )
                state.recommendations[line_item_id] = DiscountRecommendation(
                    line_item_id=line_item_id,
                    recommended_pct=recommended_pct,
                    confidence=confidence,
                    net_value=_net_value(value, recommended_pct),
                    factors=[f.model_copy() for f in factors],
                )
            self.deals[deal.id] = state

    def get_deal_state(self, deal_id: str) -> DealState:
        state = self.deals.get(deal_id)
        if state is None:
            raise NotFoundError(f"Deal '{deal_id}' not found")
        return state

    def list_deals(self) -> list[Deal]:
        return [state.deal for state in self.deals.values()]

    def blended_discount_pct(self, state: DealState) -> float:
        total_value = 0.0
        total_weighted = 0.0
        for item in state.line_items.values():
            effective = (
                item.applied_discount_pct
                if item.applied_discount_pct is not None
                else state.recommendations[item.id].recommended_pct
            )
            total_value += item.deal_value
            total_weighted += item.deal_value * effective
        if total_value == 0:
            return 0.0
        return round(total_weighted / total_value, 1)

    def add_line_item(self, deal_id: str, product_category: str, deal_value: float) -> LineItem:
        state = self.get_deal_state(deal_id)
        line_item_id = f"line-{uuid.uuid4().hex[:8]}"
        item = LineItem(
            id=line_item_id,
            deal_id=deal_id,
            product_category=product_category,
            deal_value=deal_value,
            applied_discount_pct=None,
            decision="pending",
        )
        state.line_items[line_item_id] = item
        state.recommendations[line_item_id] = generate_recommendation(line_item_id, product_category, deal_value)
        return item

    def remove_line_item(self, deal_id: str, line_item_id: str) -> None:
        state = self.get_deal_state(deal_id)
        item = state.line_items.get(line_item_id)
        if item is None:
            raise NotFoundError(f"Line item '{line_item_id}' not found on deal '{deal_id}'")
        if item.line_approval_state == "pending_approval":
            raise LineItemLockedError(
                f"Line item '{line_item_id}' is awaiting manager approval and can't be removed"
            )
        del state.line_items[line_item_id]
        state.recommendations.pop(line_item_id, None)

    def update_line_item(
        self,
        deal_id: str,
        line_item_id: str,
        product_category: str | None,
        deal_value: float | None,
    ) -> LineItem:
        state = self.get_deal_state(deal_id)
        item = state.line_items.get(line_item_id)
        if item is None:
            raise NotFoundError(f"Line item '{line_item_id}' not found on deal '{deal_id}'")
        if item.line_approval_state == "pending_approval":
            raise LineItemLockedError(
                f"Line item '{line_item_id}' is awaiting manager approval and is locked until then"
            )
        if product_category is not None:
            item.product_category = product_category
        if deal_value is not None:
            item.deal_value = deal_value
        item.applied_discount_pct = None
        item.decision = "pending"
        item.override_reason = None
        item.decided_by = None
        state.recommendations[line_item_id] = generate_recommendation(
            line_item_id, item.product_category, item.deal_value
        )
        return item

    def _log(
        self,
        item: LineItem,
        by: str,
        previous_pct: float | None,
        new_pct: float | None,
        reason: str | None,
        action: str,
    ) -> None:
        item.history.append(
            DiscountChangeEntry(
                at=datetime.now(timezone.utc).isoformat(),
                by=by,
                previous_pct=previous_pct,
                new_pct=new_pct,
                reason=reason,
                action=action,
            )
        )

    def decide_line_item(
        self,
        deal_id: str,
        line_item_id: str,
        action: str,
        applied_discount_pct: float | None,
        decided_by: str,
        reason: str | None = None,
    ) -> LineItem:
        state = self.get_deal_state(deal_id)
        item = state.line_items.get(line_item_id)
        if item is None:
            raise NotFoundError(f"Line item '{line_item_id}' not found on deal '{deal_id}'")
        if item.line_approval_state == "pending_approval":
            raise LineItemLockedError(
                f"Line item '{line_item_id}' already has a proposal awaiting manager approval"
            )

        recommendation = state.recommendations[line_item_id]
        previous = item.applied_discount_pct
        item.decided_by = decided_by

        if action == "accept":
            item.applied_discount_pct = recommendation.recommended_pct
            item.decision = "accepted"
            item.line_approval_state = "none"
            item.override_reason = None
            item.pending_discount_pct = None
            self._log(item, decided_by, previous, item.applied_discount_pct, None, "accepted")
        else:  # propose
            assert applied_discount_pct is not None
            deviation = abs(applied_discount_pct - recommendation.recommended_pct)
            item.override_reason = reason
            if deviation <= AUTO_APPROVE_BAND_PCT:
                item.applied_discount_pct = applied_discount_pct
                item.decision = "adjusted"
                item.line_approval_state = "none"
                item.pending_discount_pct = None
                self._log(
                    item, decided_by, previous, applied_discount_pct, reason, "proposed_auto_applied"
                )
            else:
                item.decision = "overridden"
                item.line_approval_state = "pending_approval"
                item.pending_discount_pct = applied_discount_pct
                # applied_discount_pct is untouched — doesn't count toward the
                # blended discount until a manager approves it.
                self._log(
                    item, decided_by, previous, applied_discount_pct, reason, "proposed_pending_approval"
                )
        return item

    def resolve_line_item_approval(
        self, deal_id: str, line_item_id: str, decision: str, decided_by: str
    ) -> LineItem:
        state = self.get_deal_state(deal_id)
        item = state.line_items.get(line_item_id)
        if item is None:
            raise NotFoundError(f"Line item '{line_item_id}' not found on deal '{deal_id}'")
        if item.line_approval_state != "pending_approval":
            raise LineItemLockedError(f"Line item '{line_item_id}' has no proposal awaiting approval")

        previous = item.applied_discount_pct
        proposed = item.pending_discount_pct
        if decision == "approved":
            item.applied_discount_pct = proposed
            item.line_approval_state = "approved"
            self._log(item, decided_by, previous, proposed, item.override_reason, "approved")
        else:
            item.line_approval_state = "rejected"
            item.decision = "pending"
            item.override_reason = None
            self._log(item, decided_by, previous, previous, None, "rejected")
        item.pending_discount_pct = None
        return item

    def set_approval(self, deal_id: str, decision: str) -> DealState:
        state = self.get_deal_state(deal_id)
        state.approval_history.append(state.deal.approval_state)
        state.deal.approval_state = decision
        return state

    def undo_approval(self, deal_id: str) -> DealState:
        state = self.get_deal_state(deal_id)
        if not state.approval_history:
            raise NotFoundError(f"No approval decision to undo for deal '{deal_id}'")
        state.deal.approval_state = state.approval_history.pop()
        return state


store = DataStore()
