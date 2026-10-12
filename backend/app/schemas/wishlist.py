from datetime import datetime

from pydantic import BaseModel

from app.schemas.product import ProductOut


class WishlistItemCreate(BaseModel):
    product_id: int


class WishlistItemOut(BaseModel):
    id: int
    product: ProductOut
    created_at: datetime

    class Config:
        from_attributes = True
