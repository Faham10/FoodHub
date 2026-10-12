from datetime import datetime

from sqlalchemy import Boolean, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    delivery_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    delivery_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=150, nullable=False)
    free_delivery_threshold: Mapped[float | None] = mapped_column(
        Numeric(10, 2), default=3000, nullable=True
    )
    minimum_order_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    delivery_areas: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="branch")
    categories = relationship("Category", back_populates="branch")
    products = relationship("Product", back_populates="branch")
    carts = relationship("Cart", back_populates="branch")
    orders = relationship("Order", back_populates="branch")
    promotions = relationship("Promotion", back_populates="branch")
