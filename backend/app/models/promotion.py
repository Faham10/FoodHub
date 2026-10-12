from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Promotion(Base):
    __tablename__ = "promotions"
    __table_args__ = (
        UniqueConstraint("branch_id", "coupon_code", name="uq_promotions_branch_coupon"),
        UniqueConstraint("branch_id", "system_key", name="uq_promotions_branch_system_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_type: Mapped[str] = mapped_column(String(16), nullable=False)
    discount_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    coupon_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    system_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    minimum_order_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    maximum_discount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    per_customer_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    applicable_product_ids: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    applicable_category_ids: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    branch = relationship("Branch", back_populates="promotions")
    redemptions = relationship("PromotionRedemption", back_populates="promotion")


class PromotionRedemption(Base):
    __tablename__ = "promotion_redemptions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    promotion_id: Mapped[int] = mapped_column(ForeignKey("promotions.id"), nullable=False, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    customer_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("promotion_id", "order_id", name="uq_promotion_redemption_order"),
    )

    promotion = relationship("Promotion", back_populates="redemptions")
