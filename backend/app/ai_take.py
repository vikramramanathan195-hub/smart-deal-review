"""A real LLM call, isolated from the deterministic recommendation engine in
store.py on purpose. generate_recommendation() stays the explainable,
reproducible core a rep decides against; this module takes its already-
computed output (factors, confidence, customer history) and asks Claude,
through LangChain, to turn it into a short narrative a rep could actually
say out loud — synthesis on top of structured logic, not a replacement for
it. If ANTHROPIC_API_KEY isn't set, callers get a clear error, not a crash.
"""

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings
from app.models import Customer, DiscountHistoryEntry, DiscountRecommendation, LineItem

SYSTEM_PROMPT = (
    "You are a sales-engineering assistant at an enterprise infrastructure vendor. "
    "A rep is about to present an AI-recommended discount on one line of a deal. The number "
    "itself is decided by a separate scoring model and is not up for debate here. "
    "The rep can already see the factor breakdown and customer history on screen, so do not "
    "restate or summarize those numbers back. Assume the rep has already read them. "
    "The confidence level is already shown separately on screen, so do not mention or restate it. "
    "Think about which direction the risk actually points before writing anything. If the number is "
    "ABOVE what this customer's history supports, the customer will not object (they're getting more), "
    "so the real risk is internal: this needs solid justification to your own manager or deal desk, "
    "since it eats into margin without precedent for it. If the number is AT or BELOW what their history "
    "supports, the risk is genuinely the customer pushing back, wanting more. Never write customer "
    "pushback for a discount that is generous relative to their history; that makes no sense. "
    "In at most 2 short sentences, name the one risk that actually applies and the single fact to "
    "back it up. Never propose a different number or range than the one given; if confidence is low, "
    "say to get sign-off rather than negotiate a different figure. "
    "Be specific and grounded in the facts given. Do not invent facts, competitors, or figures "
    "not present in the input, and do not do arithmetic yourself: every number you might need "
    "(including the gap vs. the customer's historical average) is already computed below, so "
    "quote it directly. No preamble, no bullet points, no em dashes. Plain, terse prose."
)


class AiTakeUnavailable(Exception):
    """Raised when ANTHROPIC_API_KEY isn't configured."""


def generate_ai_take(
    line_item: LineItem,
    recommendation: DiscountRecommendation,
    customer: Customer,
    discount_history: list[DiscountHistoryEntry],
) -> str:
    if not settings.anthropic_api_key:
        raise AiTakeUnavailable("ANTHROPIC_API_KEY is not configured on this deployment.")

    factor_lines = "\n".join(
        f"- {f.name}: {'+' if f.positive else ''}{f.contribution_pct:.1f} pts" for f in recommendation.factors
    )
    history_lines = (
        "\n".join(
            f"- {h.date}: {h.discount_pct:.1f}% ({h.outcome})" for h in discount_history[-4:]
        )
        or "- No prior deals on record."
    )
    delta = recommendation.recommended_pct - customer.avg_discount_pct
    vs_average = (
        f"{abs(delta):.1f} points above their historical average"
        if delta > 0
        else f"{abs(delta):.1f} points below their historical average"
        if delta < 0
        else "exactly at their historical average"
    )

    prompt = f"""Line item: {line_item.product_category}, deal value ${line_item.deal_value:,.0f}
Recommended discount: {recommendation.recommended_pct:.1f}% (confidence: {recommendation.confidence})
Factors behind that number:
{factor_lines}

Customer: {customer.name}, partner since {customer.partner_since}
Renewal rate: {customer.renewal_rate_pct:.0f}%, average historical discount: {customer.avg_discount_pct:.1f}%
Precomputed: the recommended discount is {vs_average} ({customer.avg_discount_pct:.1f}%).
Recent discount history:
{history_lines}
"""

    llm = ChatAnthropic(model="claude-sonnet-5", max_tokens=120, api_key=settings.anthropic_api_key)
    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)])
    return str(response.content).strip()
