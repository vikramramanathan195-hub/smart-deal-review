from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user, require_role
from app.models import (
    ApprovalRequest,
    ApprovalResponse,
    Deal,
    DealDetail,
    DealSummary,
    LineItemCreate,
    LineItemDecisionRequest,
    LineItemDetail,
    LineItemUpdate,
)
from app.store import DealState, NotFoundError, store

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
    deals: list[Deal] = store.list_deals()
    for deal_id in list(store.deals):
        _sync_status(store.deals[deal_id])
    return [DealSummary(id=d.id, name=d.name, status=d.status) for d in deals]


@router.get("/{deal_id}", response_model=DealDetail)
def get_deal(deal_id: str, _user=Depends(get_current_user)) -> DealDetail:
    state = _get_state_or_404(deal_id)
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
    state = store.get_deal_state(deal_id)
    return LineItemDetail(line_item=item, recommendation=state.recommendations[item.id])


@router.post("/{deal_id}/line-items/{line_item_id}/decision", response_model=LineItemDetail)
def decide_line_item(
    deal_id: str,
    line_item_id: str,
    body: LineItemDecisionRequest,
    user=Depends(require_role("sales_rep")),
) -> LineItemDetail:
    _get_state_or_404(deal_id)
    if body.action in ("adjust", "override") and body.applied_discount_pct is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {
                    "field": "appliedDiscountPct",
                    "message": f"appliedDiscountPct is required when action is '{body.action}'",
                }
            ],
        )
    try:
        item = store.decide_line_item(deal_id, line_item_id, body.action, body.applied_discount_pct)
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
    state = store.set_approval(deal_id, body.decision)
    _sync_status(state)
    return ApprovalResponse(deal_id=deal_id, status=state.deal.status, approval_state=state.deal.approval_state)


@router.post("/{deal_id}/approval/undo", response_model=ApprovalResponse)
def undo_approval(deal_id: str, user=Depends(require_role("manager"))) -> ApprovalResponse:
    try:
        state = store.undo_approval(deal_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    _sync_status(state)
    return ApprovalResponse(deal_id=deal_id, status=state.deal.status, approval_state=state.deal.approval_state)
