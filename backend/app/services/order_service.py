import json
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.branch import Branch
from app.models.promotion import Promotion, PromotionRedemption


CENT = Decimal("0.01")


def calculate_totals(cart_items):
    subtotal = sum(
        (Decimal(str(item.product.effective_price)) * item.quantity for item in cart_items),
        Decimal("0.00"),
    ).quantize(CENT, rounding=ROUND_HALF_UP)
    return {
        "subtotal": float(subtotal),
        "delivery_fee": 0.0,
        "discount": 0.0,
        "total": float(subtotal),
    }


def get_delivery_areas(branch: Branch) -> list[str]:
    if not branch.delivery_areas:
        return []
    try:
        areas = json.loads(branch.delivery_areas)
    except json.JSONDecodeError:
        areas = [area.strip() for area in branch.delivery_areas.split(",")]
    if not isinstance(areas, list):
        return []
    return [area.strip() for area in areas if isinstance(area, str) and area.strip()]


def eligible_subtotal(cart_items, promotion: Promotion) -> Decimal:
    products = set(promotion.applicable_product_ids or [])
    categories = set(promotion.applicable_category_ids or [])
    if not products and not categories:
        eligible_items = cart_items
    else:
        eligible_items = [
            item for item in cart_items
            if item.product.id in products or item.product.category_id in categories
        ]
    return sum(
        (
            Decimal(str(item.product.effective_price)) * item.quantity
            for item in eligible_items
        ),
        Decimal("0.00"),
    )


def calculate_promotion_discount(cart_items, promotion: Promotion) -> Decimal:
    eligible_amount = eligible_subtotal(cart_items, promotion)
    minimum = Decimal(str(promotion.minimum_order_amount or 0))
    if eligible_amount < minimum:
        return Decimal("0.00")

    value = Decimal(str(promotion.discount_value))
    if promotion.discount_type == "percentage":
        discount = eligible_amount * value / Decimal("100")
    else:
        discount = value
    if promotion.maximum_discount is not None:
        discount = min(discount, Decimal(str(promotion.maximum_discount)))
    return min(discount, eligible_amount).quantize(CENT, rounding=ROUND_HALF_UP)


def _customer_redemptions(db: Session, promotion: Promotion, user_id: int | None, phone: str) -> int:
    normalized_phone = "".join(character for character in phone if character.isdigit())
    query = db.query(PromotionRedemption).filter(PromotionRedemption.promotion_id == promotion.id)
    if user_id is not None:
        query = query.filter(
            or_(
                PromotionRedemption.user_id == user_id,
                PromotionRedemption.customer_phone == normalized_phone,
            )
        )
    else:
        query = query.filter(PromotionRedemption.customer_phone == normalized_phone)
    return query.count()


def _validate_usage(
    db: Session,
    promotion: Promotion,
    user_id: int | None,
    phone: str,
) -> None:
    if promotion.usage_limit is not None and promotion.usage_count >= promotion.usage_limit:
        raise HTTPException(status_code=400, detail="This promotion has reached its usage limit")
    if (
        promotion.per_customer_limit is not None
        and _customer_redemptions(db, promotion, user_id, phone) >= promotion.per_customer_limit
    ):
        raise HTTPException(status_code=400, detail="You have already used this promotion")


def _active_promotion(query, now: datetime):
    return query.filter(
        Promotion.is_active.is_(True),
        (Promotion.starts_at.is_(None) | (Promotion.starts_at <= now)),
        (Promotion.ends_at.is_(None) | (Promotion.ends_at >= now)),
    )


def calculate_order_totals(
    db: Session,
    cart_items,
    branch: Branch,
    order_type: str,
    delivery_area: str | None,
    coupon_code: str | None,
    user_id: int | None,
    phone: str,
):
    subtotal = Decimal(str(calculate_totals(cart_items)["subtotal"]))
    delivery_fee = Decimal("0.00")

    if order_type == "Delivery":
        if not branch.delivery_enabled:
            raise HTTPException(status_code=400, detail="Delivery is currently unavailable at this branch")
        minimum = Decimal(str(branch.minimum_order_amount or 0))
        if subtotal < minimum:
            raise HTTPException(
                status_code=400,
                detail=f"Delivery requires a minimum order of {minimum:.2f}",
            )
        allowed_areas = get_delivery_areas(branch)
        if allowed_areas:
            normalized_area = (delivery_area or "").strip().casefold()
            if not normalized_area or normalized_area not in {area.casefold() for area in allowed_areas}:
                raise HTTPException(status_code=400, detail="This delivery area is not supported by the selected branch")
        threshold = branch.free_delivery_threshold
        if threshold is None or subtotal < Decimal(str(threshold)):
            delivery_fee = Decimal(str(branch.delivery_fee))

    now = datetime.utcnow()
    promotion = None
    if coupon_code:
        normalized_code = coupon_code.strip().upper()
        promotion = (
            _active_promotion(
                db.query(Promotion)
                .filter(Promotion.branch_id == branch.id, Promotion.coupon_code == normalized_code)
                .with_for_update(),
                now,
            )
            .first()
        )
        if not promotion:
            raise HTTPException(status_code=400, detail="This coupon is invalid or unavailable for the selected branch")
        if subtotal < Decimal(str(promotion.minimum_order_amount or 0)):
            raise HTTPException(status_code=400, detail="Order does not meet this coupon's minimum amount")
        _validate_usage(db, promotion, user_id, phone)
        discount = calculate_promotion_discount(cart_items, promotion)
        if discount <= 0:
            raise HTTPException(status_code=400, detail="This coupon does not apply to the items in your order")
    else:
        candidates = _active_promotion(
            db.query(Promotion)
            .filter(Promotion.branch_id == branch.id, Promotion.coupon_code.is_(None))
            .with_for_update(),
            now,
        ).all()
        eligible = [
            (candidate, calculate_promotion_discount(cart_items, candidate))
            for candidate in candidates
            if candidate.usage_limit is None or candidate.usage_count < candidate.usage_limit
        ]
        eligible = [(candidate, amount) for candidate, amount in eligible if amount > 0]
        promotion, discount = None, Decimal("0.00")
        for candidate, amount in sorted(eligible, key=lambda pair: pair[1], reverse=True):
            try:
                _validate_usage(db, candidate, user_id, phone)
            except HTTPException:
                continue
            promotion, discount = candidate, amount
            break

    discount = min(discount, subtotal).quantize(CENT, rounding=ROUND_HALF_UP)
    total = max(Decimal("0.00"), subtotal + delivery_fee - discount).quantize(
        CENT, rounding=ROUND_HALF_UP
    )
    return {
        "subtotal": float(subtotal),
        "delivery_fee": float(delivery_fee),
        "discount": float(discount),
        "total": float(total),
        "promotion": promotion,
        "promotion_name": promotion.name if promotion else None,
        "coupon_code": promotion.coupon_code if promotion and promotion.coupon_code else None,
    }


def record_promotion_redemption(
    db: Session,
    promotion: Promotion | None,
    order_id: int,
    user_id: int | None,
    phone: str,
    discount_amount: float,
) -> None:
    if not promotion:
        return
    promotion.usage_count += 1
    db.add(PromotionRedemption(
        promotion_id=promotion.id,
        order_id=order_id,
        user_id=user_id,
        customer_phone="".join(character for character in phone if character.isdigit()),
        discount_amount=discount_amount,
    ))
