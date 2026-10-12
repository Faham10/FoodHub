from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_active_admin
from app.models.category import Category
from app.models.branch import Branch
from app.models.product import Product
from app.models.promotion import Promotion
from app.models.user import User
from app.schemas.promotion import PromotionCreate, PromotionOut, PromotionUpdate

router = APIRouter(prefix="/api/promotions", tags=["Promotions"])
admin_router = APIRouter(prefix="/api/admin/promotions", tags=["Admin Promotions"])


def _active(query, now: datetime):
    return query.filter(
        Promotion.is_active.is_(True),
        (Promotion.starts_at.is_(None) | (Promotion.starts_at <= now)),
        (Promotion.ends_at.is_(None) | (Promotion.ends_at >= now)),
    )


def _validate_scope(db: Session, data: dict, branch_id: int) -> None:
    product_ids = data.get("applicable_product_ids")
    if product_ids:
        count = db.query(Product.id).filter(
            Product.id.in_(product_ids),
            Product.branch_id == branch_id,
        ).count()
        if count != len(set(product_ids)):
            raise HTTPException(status_code=400, detail="Applicable products must belong to your branch")

    category_ids = data.get("applicable_category_ids")
    if category_ids:
        count = db.query(Category.id).filter(
            Category.id.in_(category_ids),
            (Category.branch_id == branch_id) | Category.branch_id.is_(None),
        ).count()
        if count != len(set(category_ids)):
            raise HTTPException(status_code=400, detail="Applicable categories must belong to your branch")


def _validate_dates(discount_type, discount_value, starts_at, ends_at):
    if discount_type == "percentage" and discount_value is not None and discount_value > 100:
        raise HTTPException(status_code=422, detail="Percentage discounts cannot exceed 100")
    if starts_at and ends_at and ends_at <= starts_at:
        raise HTTPException(status_code=422, detail="The end date must be after the start date")


@router.get("")
def list_customer_promotions(
    branch_id: int = Query(ge=1),
    db: Session = Depends(get_db),
):
    branch = db.query(Branch.id).filter(
        Branch.id == branch_id,
        Branch.is_active.is_(True),
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Selected branch is unavailable")
    now = datetime.utcnow()
    query = _active(
        db.query(Promotion).filter(
            Promotion.branch_id == branch_id,
            (Promotion.usage_limit.is_(None) | (Promotion.usage_count < Promotion.usage_limit)),
        ),
        now,
    )
    return [
        {
            "id": promotion.id,
            "name": promotion.name,
            "description": promotion.description,
            "discount_type": promotion.discount_type,
            "discount_value": float(promotion.discount_value),
            "coupon_code": promotion.coupon_code,
            "minimum_order_amount": float(promotion.minimum_order_amount),
            "maximum_discount": (
                float(promotion.maximum_discount)
                if promotion.maximum_discount is not None else None
            ),
            "applicable_product_ids": promotion.applicable_product_ids,
            "applicable_category_ids": promotion.applicable_category_ids,
            "ends_at": promotion.ends_at,
        }
        for promotion in query.order_by(Promotion.created_at.desc()).all()
    ]


@admin_router.get("", response_model=list[PromotionOut])
def list_admin_promotions(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    return db.query(Promotion).filter(
        Promotion.branch_id == admin.branch_id
    ).order_by(Promotion.created_at.desc()).all()


@admin_router.post("", response_model=PromotionOut, status_code=201)
def create_promotion(
    payload: PromotionCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    data = payload.model_dump()
    _validate_scope(db, data, admin.branch_id)
    _validate_dates(data["discount_type"], data["discount_value"], data["starts_at"], data["ends_at"])
    promotion = Promotion(**data, branch_id=admin.branch_id)
    db.add(promotion)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="This coupon code already exists for your branch") from error
    db.refresh(promotion)
    return promotion


@admin_router.put("/{promotion_id}", response_model=PromotionOut)
def update_promotion(
    promotion_id: int,
    payload: PromotionUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    promotion = db.query(Promotion).filter(
        Promotion.id == promotion_id,
        Promotion.branch_id == admin.branch_id,
    ).with_for_update().first()
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion not found")

    changes = payload.model_dump(exclude_unset=True)
    if any(
        field in changes and changes[field] is None
        for field in ("name", "discount_type", "discount_value", "minimum_order_amount", "is_active")
    ):
        raise HTTPException(status_code=422, detail="Required promotion fields cannot be null")
    merged = {
        "discount_type": changes.get("discount_type", promotion.discount_type),
        "discount_value": changes.get("discount_value", promotion.discount_value),
        "starts_at": changes.get("starts_at", promotion.starts_at),
        "ends_at": changes.get("ends_at", promotion.ends_at),
    }
    _validate_dates(**merged)
    if "usage_limit" in changes and changes["usage_limit"] is not None:
        if changes["usage_limit"] < promotion.usage_count:
            raise HTTPException(status_code=400, detail="Usage limit cannot be lower than redemptions already recorded")
    _validate_scope(db, changes, admin.branch_id)
    if changes.get("coupon_code") and changes.get("per_customer_limit") is None:
        changes["per_customer_limit"] = 1
    for field, value in changes.items():
        setattr(promotion, field, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="This coupon code already exists for your branch") from error
    db.refresh(promotion)
    return promotion


@admin_router.delete("/{promotion_id}", response_model=PromotionOut)
def archive_promotion(
    promotion_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    promotion = db.query(Promotion).filter(
        Promotion.id == promotion_id,
        Promotion.branch_id == admin.branch_id,
    ).first()
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion not found")
    promotion.is_active = False
    db.commit()
    db.refresh(promotion)
    return promotion
