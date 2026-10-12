import enum
from datetime import datetime

from sqlalchemy import String, Numeric, Integer, DateTime, ForeignKey, Enum, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrderStatus(str, enum.Enum):
    pending = "Pending"
    confirmed = "Confirmed"
    preparing = "Preparing"
    out_for_delivery = "Out for Delivery"
    delivered = "Delivered"
    cancelled = "Cancelled"


class PaymentStatus(str, enum.Enum):
    pending = "Pending"
    paid = "Paid"
    failed = "Failed"


class PaymentMethod(str, enum.Enum):
    cod = "Cash on Delivery"
    card = "Card"


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("uq_orders_branch_order_number", "branch_id", "order_number", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), nullable=False, index=True)
    order_number: Mapped[str] = mapped_column(String(32), nullable=False)
    branch_name: Mapped[str] = mapped_column(String(80), nullable=False)
    order_type: Mapped[str] = mapped_column(String(20), nullable=False, default="Delivery")
    tracking_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    address_id: Mapped[int] = mapped_column(ForeignKey("addresses.id"), nullable=True)

    customer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    delivery_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    table_info: Mapped[str | None] = mapped_column(String(120), nullable=True)
    delivery_area: Mapped[str | None] = mapped_column(String(120), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    delivery_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    discount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    promotion_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    coupon_code: Mapped[str | None] = mapped_column(String(40), nullable=True)

    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), default=PaymentMethod.cod)
    payment_status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.pending)
    order_status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.pending)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="orders")
    address = relationship("Address", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    branch = relationship("Branch", back_populates="orders")


class BranchOrderSequence(Base):
    __tablename__ = "branch_order_sequences"

    branch_id: Mapped[int] = mapped_column(
        ForeignKey("branches.id", ondelete="CASCADE"),
        primary_key=True,
    )
    last_number: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=True)

    product_name: Mapped[str] = mapped_column(String(150), nullable=False)
    product_image: Mapped[str] = mapped_column(String(255), nullable=True)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
