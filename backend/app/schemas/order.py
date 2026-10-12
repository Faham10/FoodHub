from datetime import datetime
import enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.order import OrderStatus, PaymentStatus, PaymentMethod


class OrderType(str, enum.Enum):
    delivery = "Delivery"
    pick_up = "Pick-Up"
    dine_in = "Dine-In"


class OrderItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100)


class OrderCreate(BaseModel):
    branch_id: int
    branch_name: str | None = None
    order_type: OrderType = OrderType.delivery
    customer_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=7, max_length=30)
    delivery_address: str | None = Field(default=None, max_length=1000)
    delivery_area: str | None = Field(default=None, max_length=120)
    coupon_code: str | None = Field(default=None, min_length=1, max_length=40)
    table_info: str | None = Field(default=None, max_length=120)
    instructions: str | None = Field(default=None, max_length=2000)
    address_id: int | None = None
    items: list[OrderItemCreate] | None = Field(default=None, min_length=1, max_length=100)
    payment_method: PaymentMethod = PaymentMethod.cod

    @field_validator("customer_name")
    @classmethod
    def strip_customer_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Customer name must contain at least 2 characters")
        return value

    @field_validator("phone")
    @classmethod
    def strip_phone(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 7:
            raise ValueError("Mobile number must contain at least 7 characters")
        return value

    @model_validator(mode="after")
    def validate_order_location(self):
        if self.order_type == OrderType.delivery and not (self.delivery_address or "").strip():
            raise ValueError("Delivery address is required for delivery orders")
        if self.delivery_area is not None:
            self.delivery_area = self.delivery_area.strip() or None
        if self.coupon_code is not None:
            self.coupon_code = self.coupon_code.strip().upper() or None
        if self.order_type == OrderType.dine_in and not (self.table_info or "").strip():
            raise ValueError("Table information is required for dine-in orders")
        return self


class OrderItemOut(BaseModel):
    id: int
    product_id: Optional[int]
    product_name: str
    product_image: Optional[str] = None
    unit_price: float
    quantity: int
    line_total: float

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    order_number: str
    branch_id: int
    branch_name: str
    order_type: OrderType
    customer_name: str
    phone: str
    delivery_address: str | None
    delivery_area: str | None = None
    table_info: str | None
    instructions: str | None
    subtotal: float
    delivery_fee: float
    discount: float
    promotion_name: str | None = None
    coupon_code: str | None = None
    total: float
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    order_status: OrderStatus
    created_at: datetime
    items: list[OrderItemOut]

    class Config:
        from_attributes = True


class OrderListOut(BaseModel):
    id: int
    order_number: str
    branch_id: int
    branch_name: str
    order_type: OrderType
    customer_name: str
    phone: str
    total: float
    payment_status: PaymentStatus
    order_status: OrderStatus
    created_at: datetime

    class Config:
        from_attributes = True


class AdminOrderUpdate(BaseModel):
    order_status: Optional[OrderStatus] = None
    payment_status: Optional[PaymentStatus] = None


class OrderCreatedOut(OrderOut):
    tracking_token: str
