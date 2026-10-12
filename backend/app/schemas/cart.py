from pydantic import BaseModel, Field

from app.schemas.product import ProductOut


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1)
    branch_id: int = Field(ge=1)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1)


class CartItemOut(BaseModel):
    id: int
    product: ProductOut
    quantity: int
    line_total: float

    class Config:
        from_attributes = True


class CartOut(BaseModel):
    branch_id: int | None = None
    items: list[CartItemOut]
    subtotal: float
    delivery_fee: float
    discount: float
    total: float
