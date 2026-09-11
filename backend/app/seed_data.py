"""Seed data mirroring frontend/src/lib/deal-data.ts exactly, so the two sample
deals look identical once the frontend is wired up to this API."""

from app.models import Customer, Deal, DiscountHistoryEntry, Factor, LineItem

NORTHWIND_CUSTOMER = Customer(
    id="cust-northwind",
    name="Northwind Industries",
    partner_since=2022,
    lifetime_value="$1.24M",
    renewal_rate_pct=100.0,
    avg_discount_pct=10.7,
)

NORTHWIND_HISTORY = [
    DiscountHistoryEntry(customer_id="cust-northwind", date="Mar 2023", discount_pct=9.0, outcome="won"),
    DiscountHistoryEntry(customer_id="cust-northwind", date="Sep 2023", discount_pct=11.5, outcome="won"),
    DiscountHistoryEntry(customer_id="cust-northwind", date="Feb 2024", discount_pct=14.0, outcome="lost"),
    DiscountHistoryEntry(customer_id="cust-northwind", date="Nov 2024", discount_pct=8.5, outcome="won"),
]

CERULEAN_CUSTOMER = Customer(
    id="cust-cerulean",
    name="Cerulean Logistics",
    partner_since=2025,
    lifetime_value="$310K",
    renewal_rate_pct=67.0,
    avg_discount_pct=13.4,
)

CERULEAN_HISTORY = [
    DiscountHistoryEntry(customer_id="cust-cerulean", date="Jan 2025", discount_pct=12.0, outcome="lost"),
    DiscountHistoryEntry(customer_id="cust-cerulean", date="Jun 2025", discount_pct=14.5, outcome="won"),
    DiscountHistoryEntry(customer_id="cust-cerulean", date="Dec 2025", discount_pct=13.5, outcome="lost"),
    DiscountHistoryEntry(customer_id="cust-cerulean", date="Feb 2026", discount_pct=16.0, outcome="won"),
]


def _factor(name: str, contribution_pct: float) -> Factor:
    return Factor(name=name, contribution_pct=contribution_pct, positive=contribution_pct >= 0)


BASE_FACTORS = [
    _factor("Baseline (segment: Enterprise)", 8.0),
    _factor("Customer tenure (4 yrs)", 2.5),
    _factor("Deal size tier", 2.0),
    _factor("Regional competitive pressure", 1.5),
    _factor("Margin floor guardrail", -2.0),
]

STORAGE_FACTORS = [
    _factor("Baseline (segment: Enterprise)", 8.0),
    _factor("Customer tenure (4 yrs)", 2.5),
    _factor("Deal size tier", 1.0),
    _factor("Regional competitive pressure", 2.5),
    _factor("Margin floor guardrail", -1.5),
]

SERVICES_FACTORS = [
    _factor("Baseline (segment: Enterprise)", 8.0),
    _factor("Customer tenure (4 yrs)", 2.5),
    _factor("Deal size tier", 3.0),
    _factor("Regional competitive pressure", 4.0),
    _factor("Margin floor guardrail", -2.5),
]

AGGRESSIVE_FACTORS = [
    _factor("Baseline (segment: Enterprise)", 8.0),
    _factor("Competitive displacement", 6.0),
    _factor("Deal size tier", 3.0),
    _factor("Multi-year term commitment", 2.0),
    _factor("Margin floor guardrail", -1.0),
]

SERVICES_AGGRESSIVE_FACTORS = [
    _factor("Baseline (segment: Enterprise)", 8.0),
    _factor("Competitive displacement", 7.0),
    _factor("Deal size tier", 2.5),
    _factor("Regional competitive pressure", 4.0),
    _factor("Margin floor guardrail", -2.0),
]


NORTHWIND_DEAL = Deal(
    id="northwind",
    name="Northwind Industries — FY27 Expansion",
    term_length="24mo",
    product_categories=["Compute", "Storage"],
    sample_deal_key="northwind",
    status="within_range",
    approval_state=None,
)

# (line_item_id, product_category, deal_value, recommended_pct, confidence, factors)
NORTHWIND_LINE_ITEMS = [
    ("line-seed-1", "Compute", 180000.0, 12.0, "high", BASE_FACTORS),
    ("line-seed-2", "Storage", 96500.0, 12.5, "medium", STORAGE_FACTORS),
    ("line-seed-3", "Services", 42000.0, 15.0, "low", SERVICES_FACTORS),
]

CERULEAN_DEAL = Deal(
    id="cerulean",
    name="Cerulean Logistics — Competitive Displacement",
    term_length="36mo",
    product_categories=["Networking", "Services", "Compute"],
    sample_deal_key="cerulean",
    status="needs_approval",
    approval_state=None,
)

CERULEAN_LINE_ITEMS = [
    ("line-esc-1", "Networking", 220000.0, 18.0, "low", AGGRESSIVE_FACTORS),
    ("line-esc-2", "Services", 130000.0, 19.5, "low", SERVICES_AGGRESSIVE_FACTORS),
    ("line-esc-3", "Compute", 75000.0, 16.0, "medium", AGGRESSIVE_FACTORS),
]
