import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class PromotionBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    discount_type: Literal["fixed", "percentage"]
    discount_value: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    coupon_code: str | None = Field(default=None, max_length=40)
    minimum_order_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=2)
    maximum_discount: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    usage_limit: int | None = Field(default=None, gt=0)
    per_customer_limit: int | None = Field(default=None, gt=0)
    applicable_product_ids: list[int] | None = None
    applicable_category_ids: list[int] | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool = True

    @field_validator("name", "description")
    @classmethod
    def strip_text(cls, value):
        return value.strip() if value else value

    @field_validator("coupon_code")
    @classmethod
    def normalize_code(cls, value):
        if value is None or not value.strip():
            return None
        code = value.strip().upper()
        if not re.fullmatch(r"[A-Z0-9_-]+", code):
            raise ValueError("Coupon codes may contain only letters, numbers, hyphens, and underscores")
        return code

    @field_validator("starts_at", "ends_at")
    @classmethod
    def normalize_datetime(cls, value):
        if value is not None and value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    @field_validator("applicable_product_ids", "applicable_category_ids")
    @classmethod
    def unique_positive_ids(cls, value):
        if value is not None and (any(item <= 0 for item in value) or len(set(value)) != len(value)):
            raise ValueError("Applicable IDs must be unique positive integers")
        return value

    @model_validator(mode="after")
    def validate_promotion(self):
        if self.discount_type == "percentage" and self.discount_value > 100:
            raise ValueError("Percentage discounts cannot exceed 100")
        if self.ends_at and self.starts_at and self.ends_at <= self.starts_at:
            raise ValueError("The end date must be after the start date")
        if self.coupon_code and self.per_customer_limit is None:
            self.per_customer_limit = 1
        return self


class PromotionCreate(PromotionBase):
    pass


class PromotionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    discount_type: Literal["fixed", "percentage"] | None = None
    discount_value: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    coupon_code: str | None = Field(default=None, max_length=40)
    minimum_order_amount: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    maximum_discount: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    usage_limit: int | None = Field(default=None, gt=0)
    per_customer_limit: int | None = Field(default=None, gt=0)
    applicable_product_ids: list[int] | None = None
    applicable_category_ids: list[int] | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool | None = None

    @field_validator("coupon_code")
    @classmethod
    def normalize_code(cls, value):
        if value is None or not value.strip():
            return None
        code = value.strip().upper()
        if not re.fullmatch(r"[A-Z0-9_-]+", code):
            raise ValueError("Coupon codes may contain only letters, numbers, hyphens, and underscores")
        return code

    @field_validator("starts_at", "ends_at")
    @classmethod
    def normalize_datetime(cls, value):
        if value is not None and value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value


class PromotionOut(PromotionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    branch_id: int
    usage_count: int
    created_at: datetime
    updated_at: datetime
