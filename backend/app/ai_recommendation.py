"""Generates a line item's discount recommendation with Claude, via
LangChain, using the real customer and deal data already loaded from
Supabase — replacing the deterministic formula in store.py.generate_
recommendation() when ANTHROPIC_API_KEY is set.

The model proposes the factor breakdown (a baseline plus a handful of named
adjustments); the final recommended percentage is always the sum of those
factors, computed here in Python rather than trusted from the model's own
arithmetic — the same "pre-compute, don't ask the model to add" pattern
used in ai_take.py. If the call fails or returns something unusable, the
caller falls back to the deterministic value; a Claude hiccup should never
break the app.
"""

from langchain_anthropic import ChatAnthropic
from pydantic import BaseModel, Field

from app.config import settings
from app.models import Customer, DiscountHistoryEntry, Factor, LineItem

SYSTEM_PROMPT = (
    "You are the discount-recommendation engine for a B2B sales tool at an enterprise "
    "infrastructure vendor. Given a line item and the customer's real deal history, propose "
    "a discount as a baseline plus 3-4 named adjustment factors (e.g. customer tenure, deal size "
    "tier, competitive pressure, renewal loyalty) and one negative 'Margin floor guardrail' factor. "
    "Ground every factor in the actual data given — do not invent history or reasons not supported "
    "by it. Confidence should be 'high' when the customer's discount history clearly supports this "
    "range, 'low' when there's little or conflicting precedent, 'medium' otherwise."
)


class RecommendationFactor(BaseModel):
    name: str = Field(description="Short label, e.g. 'Baseline (segment: Enterprise)' or 'Deal size tier'")
    contribution_pct: float = Field(description="Points added (positive) or subtracted (negative)")
    positive: bool


class RecommendationOutput(BaseModel):
    confidence: str = Field(description="One of: low, medium, high")
    factors: list[RecommendationFactor] = Field(
        description="4-5 factors: one baseline, 2-3 adjustments, one negative margin floor guardrail"
    )


class AiRecommendationUnavailable(Exception):
    pass


def generate_ai_recommendation(
    line_item: LineItem,
    customer: Customer,
    discount_history: list[DiscountHistoryEntry],
) -> dict:
    if not settings.anthropic_api_key:
        raise AiRecommendationUnavailable("ANTHROPIC_API_KEY is not configured on this deployment.")

    history_lines = (
        "\n".join(f"- {h.date}: {h.discount_pct:.1f}% ({h.outcome})" for h in discount_history[-6:])
        or "- No prior deals on record."
    )

    prompt = f"""Line item: {line_item.product_category}, deal value ${line_item.deal_value:,.0f}

Customer: {customer.name}, partner since {customer.partner_since}
Renewal rate: {customer.renewal_rate_pct:.0f}%, average historical discount: {customer.avg_discount_pct:.1f}%
Discount history:
{history_lines}
"""

    llm = ChatAnthropic(model="claude-sonnet-5", max_tokens=500, api_key=settings.anthropic_api_key)
    structured = llm.with_structured_output(RecommendationOutput)
    result = structured.invoke([{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}])

    if not isinstance(result, RecommendationOutput) or not result.factors:
        raise AiRecommendationUnavailable("Model returned an unusable response.")

    recommended_pct = round(sum(f.contribution_pct for f in result.factors), 1)
    if not (0 < recommended_pct < 60):
        raise AiRecommendationUnavailable(f"Generated recommendation out of sane range: {recommended_pct}")

    confidence = result.confidence.lower().strip()
    if confidence not in ("low", "medium", "high"):
        confidence = "medium"

    return {
        "recommended_pct": recommended_pct,
        "confidence": confidence,
        "factors": [
            Factor(name=f.name, contribution_pct=f.contribution_pct, positive=f.positive) for f in result.factors
        ],
    }
