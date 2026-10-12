import json
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.branch import Branch
from app.models.user import User
from app.dependencies.auth import get_current_active_admin
from app.services.order_service import get_delivery_areas

router = APIRouter(prefix="/api/branches", tags=["Branches"])
admin_router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("")
def list_active_branches(db: Session = Depends(get_db)):
    return [
        {"id": branch.id, "name": branch.name, "address": branch.address}
        for branch in db.query(Branch).filter(Branch.is_active.is_(True)).order_by(Branch.id).all()
    ]


def _delivery_settings(branch: Branch):
    return {
        "branch_id": branch.id,
        "delivery_enabled": branch.delivery_enabled,
        "delivery_fee": float(branch.delivery_fee),
        "free_delivery_threshold": (
            float(branch.free_delivery_threshold)
            if branch.free_delivery_threshold is not None else None
        ),
        "minimum_order_amount": float(branch.minimum_order_amount),
        "delivery_areas": get_delivery_areas(branch),
    }


@router.get("/{branch_id}/delivery")
def get_branch_delivery_settings(branch_id: int, db: Session = Depends(get_db)):
    branch = db.query(Branch).filter(Branch.id == branch_id, Branch.is_active.is_(True)).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Selected branch is unavailable")
    return _delivery_settings(branch)


class DeliverySettingsUpdate(BaseModel):
    delivery_enabled: bool
    delivery_fee: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    free_delivery_threshold: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    minimum_order_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=2)
    delivery_areas: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("delivery_areas")
    @classmethod
    def clean_areas(cls, areas):
        cleaned = [area.strip() for area in areas]
        if any(not area or len(area) > 120 for area in cleaned):
            raise ValueError("Delivery areas must contain 1 to 120 characters")
        if len({area.casefold() for area in cleaned}) != len(cleaned):
            raise ValueError("Delivery areas must be unique")
        return cleaned


@admin_router.get("/delivery-settings")
def get_admin_delivery_settings(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    branch = db.query(Branch).filter(Branch.id == admin.branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Admin branch not found")
    return _delivery_settings(branch)


@admin_router.put("/delivery-settings")
def update_admin_delivery_settings(
    payload: DeliverySettingsUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    branch = db.query(Branch).filter(Branch.id == admin.branch_id).with_for_update().first()
    if not branch:
        raise HTTPException(status_code=404, detail="Admin branch not found")
    branch.delivery_enabled = payload.delivery_enabled
    branch.delivery_fee = payload.delivery_fee
    branch.free_delivery_threshold = payload.free_delivery_threshold
    branch.minimum_order_amount = payload.minimum_order_amount
    branch.delivery_areas = json.dumps(payload.delivery_areas)
    db.commit()
    db.refresh(branch)
    return _delivery_settings(branch)
