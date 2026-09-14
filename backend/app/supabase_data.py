"""Loads the store's seed data from Supabase (see supabase/schema.sql)
instead of the hardcoded literals in seed_data.py.

Only used at startup, to build the same in-memory DealState objects
store.py has always used — every mutation (accept/propose/approve/undo)
still happens in process memory afterward, unchanged. If Supabase is
unset or unreachable, callers should catch the exception and fall back
to seed_data.py; a Supabase outage should never take the app down.
"""

import httpx

from app.config import settings
from app.models import Customer, Deal, DiscountHistoryEntry, Factor, LineItem


class SupabaseUnavailable(Exception):
    pass


def _get(table: str, params: dict | None = None) -> list[dict]:
    url = f"{settings.supabase_url}/rest/v1/{table}"
    headers = {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
    }
    resp = httpx.get(url, headers=headers, params=params, timeout=10.0)
    resp.raise_for_status()
    return resp.json()


def load_deal_states() -> list[tuple[Deal, Customer, list[DiscountHistoryEntry], list[LineItem], dict[str, dict]]]:
    """Returns one tuple per deal: (deal, customer, history, line_items,
    {line_item_id: {"recommended_pct", "confidence", "net_value", "factors": [...]}})."""
    if not settings.supabase_url or not settings.supabase_service_key:
        raise SupabaseUnavailable("SUPABASE_URL / SUPABASE_SERVICE_KEY not configured")

    customers_raw = _get("customers")
    history_raw = _get("discount_history")
    deals_raw = _get("deals")
    line_items_raw = _get("line_items")
    recs_raw = _get("recommendations")
    factors_raw = _get("recommendation_factors", params={"order": "line_item_id,sort_order"})

    customers = {c["id"]: Customer(**c) for c in customers_raw}

    history_by_customer: dict[str, list[DiscountHistoryEntry]] = {}
    for h in history_raw:
        history_by_customer.setdefault(h["customer_id"], []).append(DiscountHistoryEntry(**h))

    factors_by_line: dict[str, list[Factor]] = {}
    for f in factors_raw:
        factors_by_line.setdefault(f["line_item_id"], []).append(
            Factor(name=f["name"], contribution_pct=f["contribution_pct"], positive=f["positive"])
        )

    rec_by_line = {r["line_item_id"]: r for r in recs_raw}

    line_items_by_deal: dict[str, list[LineItem]] = {}
    for li in line_items_raw:
        line_items_by_deal.setdefault(li["deal_id"], []).append(
            LineItem(
                id=li["id"],
                deal_id=li["deal_id"],
                product_category=li["product_category"],
                deal_value=li["deal_value"],
            )
        )

    results = []
    for d in deals_raw:
        deal = Deal(
            id=d["id"],
            name=d["name"],
            term_length=d["term_length"],
            product_categories=d["product_categories"],
            sample_deal_key=d["id"],
            status=d["status"],
            region=d.get("region") or "north_america",
        )
        customer = customers[d["customer_id"]]
        history = history_by_customer.get(d["customer_id"], [])
        line_items = line_items_by_deal.get(d["id"], [])
        rec_specs = {}
        for li in line_items:
            rec = rec_by_line.get(li.id)
            if not rec:
                continue
            rec_specs[li.id] = {
                "recommended_pct": rec["recommended_pct"],
                "confidence": rec["confidence"],
                "net_value": rec["net_value"],
                "factors": factors_by_line.get(li.id) or [],
            }
        results.append((deal, customer, history, line_items, rec_specs))

    return results
