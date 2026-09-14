from fastapi import APIRouter, Depends, HTTPException, status

from app.ai_take import AiTakeUnavailable, generate_ai_take
from app.auth import get_current_user, require_role
from app.models import (
    ApprovalRequest,
    ApprovalResponse,
    DealCreate,
    DealDetail,
    DealSummary,
    DealUpdate,
    SendQuoteRequest,
    LineItemApprovalRequest,
    LineItemCreate,
    LineItemDecisionRequest,
    LineItemDetail,
    LineItemUpdate,
)
from app.store import DealState, LineItemLockedError, NotFoundError, store

router = APIRouter(prefix="/api/deals", tags=["deals"])

APPROVAL_THRESHOLD_PCT = 15.0


def _sync_status(state: DealState) -> None:
    blended = store.blended_discount_pct(state)
    state.deal.status = "needs_approval" if blended > APPROVAL_THRESHOLD_PCT else "within_range"


def _to_detail(state: DealState) -> DealDetail:
    _sync_status(state)
    line_items = [
        LineItemDetail(line_item=item, recommendation=state.recommendations[item.id])
        for item in state.line_items.values()
    ]
    return DealDetail(
        deal=state.deal,
        line_items=line_items,
        customer=state.customer,
        discount_history=state.discount_history,
        blended_discount_pct=store.blended_discount_pct(state),
    )


def _get_state_or_404(deal_id: str) -> DealState:
    try:
        return store.get_deal_state(deal_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("", response_model=list[DealSummary])
def list_deals(_user=Depends(get_current_user)) -> list[DealSummary]:
    for deal_id in list(store.deals):
        _sync_status(store.deals[deal_id])
    return [
        DealSummary(
            id=state.deal.id,
            name=state.deal.name,
            status=state.deal.status,
            approval_state=state.deal.approval_state,
            deal_value_total=sum(item.deal_value for item in state.line_items.values()),
            blended_discount_pct=store.blended_discount_pct(state),
            region=state.deal.region,
            customer_name=state.customer.name,
            line_item_count=len(state.line_items),
            decided_line_count=store.line_progress(state)[0],
            in_review_line_count=store.line_progress(state)[1],
            quote_sent_at=state.deal.quote_sent_at,
            term_length=state.deal.term_length,
            product_categories=state.deal.product_categories,
        )
        for state in store.deals.values()
    ]


@router.post("", response_model=DealDetail, status_code=status.HTTP_201_CREATED)
def create_deal(body: DealCreate, _user=Depends(get_current_user)) -> DealDetail:
    state = store.create_deal(
        name=body.name,
        customer_name=body.customer_name,
        term_length=body.term_length,
        region=body.region,
        product_categories=body.product_categories,
    )
    return _to_detail(state)


@router.get("/{deal_id}", response_model=DealDetail)
def get_deal(deal_id: str, _user=Depends(get_current_user)) -> DealDetail:
    state = _get_state_or_404(deal_id)
    return _to_detail(state)


@router.patch("/{deal_id}", response_model=DealDetail)
def update_deal(deal_id: str, body: DealUpdate, _user=Depends(get_current_user)) -> DealDetail:
    state = _get_state_or_404(deal_id)
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A deal needs a name.",
            )
        state.deal.name = name
    if body.region is not None:
        # Region drives currency on the frontend. Changing it never converts
        # existing line item values — they're just reinterpreted in the new
        # currency going forward, same as switching a spreadsheet's currency
        # column without recalculating the numbers in it.
        state.deal.region = body.region
    if body.product_categories is not None:
        if not body.product_categories:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A deal must have at least one product category.",
            )
        state.deal.product_categories = body.product_categories
    if body.term_length is not None:
        state.deal.term_length = body.term_length
    return _to_detail(state)


@router.post("/{deal_id}/line-items", response_model=LineItemDetail, status_code=status.HTTP_201_CREATED)
def add_line_item(deal_id: str, body: LineItemCreate, _user=Depends(get_current_user)) -> LineItemDetail:
    _get_state_or_404(deal_id)
    item = store.add_line_item(deal_id, body.product_category, body.deal_value)
    state = store.get_deal_state(deal_id)
    return LineItemDetail(line_item=item, recommendation=state.recommendations[item.id])


@router.delete("/{deal_id}/line-items/{line_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_line_item(deal_id: str, line_item_id: str, _user=Depends(get_current_user)) -> None:
    _get_state_or_404(deal_id)
    try:
        store.remove_line_item(deal_id, line_item_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LineItemLockedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.patch("/{deal_id}/line-items/{line_item_id}", response_model=LineItemDetail)
def update_line_item(
    deal_id: str,
    line_item_id: str,
    body: LineItemUpdate,
    _user=Depends(get_current_user),
) -> LineItemDetail:
    _get_state_or_404(deal_id)
    try:
        item = store.update_line_item(deal_id, line_item_id, body.product_category, body.deal_value)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LineItemLockedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    state = store.get_deal_state(deal_id)
    return LineItemDetail(line_item=item, recommendation=state.recommendations[item.id])


@router.post("/{deal_id}/line-items/{line_item_id}/ai-take", response_model=dict[str, str])
def get_ai_take(deal_id: str, line_item_id: str, _user=Depends(get_current_user)) -> dict[str, str]:
    """A real Claude call (via LangChain) that turns the already-computed
    recommendation into a short spoken-style narrative. Deliberately separate
    from generate_recommendation() in store.py, which stays the deterministic
    core — this only synthesizes on top of it."""
    state = _get_state_or_404(deal_id)
    item = state.line_items.get(line_item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Line item '{line_item_id}' not found")
    recommendation = state.recommendations[line_item_id]
    try:
        text = generate_ai_take(item, recommendation, state.customer, state.discount_history)
    except AiTakeUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return {"text": text}


@router.post("/{deal_id}/line-items/{line_item_id}/decision", response_model=LineItemDetail)
def decide_line_item(
    deal_id: str,
    line_item_id: str,
    body: LineItemDecisionRequest,
    user=Depends(require_role("sales_rep")),
) -> LineItemDetail:
    _get_state_or_404(deal_id)
    if body.action == "propose" and body.applied_discount_pct is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {
                    "field": "appliedDiscountPct",
                    "message": "appliedDiscountPct is required when proposing a discount",
                }
            ],
        )
    # Every manually-proposed discount needs a reason, not just ones outside
    # the auto-approve band.
    if body.action == "propose" and not (body.reason or "").strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[{"field": "reason", "message": "reason is required when proposing a discount"}],
        )
    try:
        item = store.decide_line_item(
            deal_id,
            line_item_id,
            body.action,
            body.applied_discount_pct,
            decided_by=user.email,
            reason=(body.reason or "").strip() or None,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LineItemLockedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    state = store.get_deal_state(deal_id)
    return LineItemDetail(line_item=item, recommendation=state.recommendations[item.id])


@router.post("/{deal_id}/line-items/{line_item_id}/approval", response_model=LineItemDetail)
def decide_line_item_approval(
    deal_id: str,
    line_item_id: str,
    body: LineItemApprovalRequest,
    user=Depends(require_role("manager")),
) -> LineItemDetail:
    _get_state_or_404(deal_id)
    try:
        item = store.resolve_line_item_approval(deal_id, line_item_id, body.decision, decided_by=user.email)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LineItemLockedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    state = store.get_deal_state(deal_id)
    return LineItemDetail(line_item=item, recommendation=state.recommendations[item.id])


@router.post("/{deal_id}/line-items/{line_item_id}/decision/undo", response_model=LineItemDetail)
def undo_line_item_decision(
    deal_id: str, line_item_id: str, _user=Depends(get_current_user)
) -> LineItemDetail:
    try:
        item = store.undo_line_item_decision(deal_id, line_item_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    state = store.get_deal_state(deal_id)
    return LineItemDetail(line_item=item, recommendation=state.recommendations[item.id])


@router.post("/{deal_id}/approval", response_model=ApprovalResponse)
def decide_approval(
    deal_id: str,
    body: ApprovalRequest,
    user=Depends(require_role("manager")),
) -> ApprovalResponse:
    state = _get_state_or_404(deal_id)
    blended = store.blended_discount_pct(state)
    if blended <= APPROVAL_THRESHOLD_PCT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Deal '{deal_id}' has a blended discount of {blended}%, which does not exceed the "
                f"{APPROVAL_THRESHOLD_PCT}% approval threshold — no manager decision is required."
            ),
        )
    state = store.set_approval(deal_id, body.decision, note=(body.note or "").strip() or None)
    _sync_status(state)
    return ApprovalResponse(deal_id=deal_id, status=state.deal.status, approval_state=state.deal.approval_state)


@router.post("/{deal_id}/quote/send", response_model=DealDetail)
def send_quote(deal_id: str, body: SendQuoteRequest, _user=Depends(get_current_user)) -> DealDetail:
    state = _get_state_or_404(deal_id)
    if not state.line_items:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Add at least one line item before sending.")
    decided, in_review = store.line_progress(state)
    if in_review > 0 or decided < len(state.line_items):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Every line needs a decision before the quote can be sent.",
        )
    blended = store.blended_discount_pct(state)
    if blended > APPROVAL_THRESHOLD_PCT and state.deal.approval_state != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This deal is over the {APPROVAL_THRESHOLD_PCT}% ceiling and needs manager approval first.",
        )
    state = store.send_quote(deal_id, body.recipient.strip())
    return _to_detail(state)


@router.post("/{deal_id}/quote/send/undo", response_model=DealDetail)
def undo_send_quote(deal_id: str, _user=Depends(get_current_user)) -> DealDetail:
    try:
        state = store.undo_send_quote(deal_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _to_detail(state)


@router.post("/{deal_id}/approval/undo", response_model=ApprovalResponse)
def undo_approval(deal_id: str, user=Depends(require_role("manager"))) -> ApprovalResponse:
    try:
        state = store.undo_approval(deal_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _sync_status(state)
    return ApprovalResponse(deal_id=deal_id, status=state.deal.status, approval_state=state.deal.approval_state)
