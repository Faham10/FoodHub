from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.category import CategoryOut


class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = Field(gt=0)
    sale_price: Optional[float] = Field(default=None, ge=0)
    category_id: int
    image: Optional[str] = None
    sku: str
    stock: int = Field(default=0, ge=0)
    featured: bool = False
    popular: bool = False
    available: bool = True
    branch_id: int | None = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    sale_price: Optional[float] = None
    category_id: Optional[int] = None
    image: Optional[str] = None
    sku: Optional[str] = None
    stock: Optional[int] = None
    featured: Optional[bool] = None
    popular: Optional[bool] = None
    available: Optional[bool] = None


class ProductOut(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    category: Optional[CategoryOut] = None
    effective_price: float

    class Config:
        from_attributes = True


class PaginatedProducts(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int
    total_pages: int
