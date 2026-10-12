import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, asc, desc

from app.database import get_db
from app.models.cart import CartItem
from app.models.product import Product
from app.models.category import Category
from app.models.order import OrderItem
from app.models.user import User
from app.models.wishlist import WishlistItem
from app.schemas.product import ProductOut, ProductCreate, ProductUpdate, PaginatedProducts
from app.dependencies.auth import get_current_active_admin, get_optional_user

router = APIRouter(prefix="/api/products", tags=["Products"])


@router.get("", response_model=PaginatedProducts)
def list_products(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    category_slug: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    available_only: bool = False,
    featured: Optional[bool] = None,
    popular: Optional[bool] = None,
    branch_id: Optional[int] = Query(default=None, ge=1),
    sort: Optional[str] = Query(default=None, description="price_asc | price_desc | newest | popular"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    query = db.query(Product).options(joinedload(Product.category))
    branch = current_user.branch_id if current_user and current_user.role.value == "branch_admin" else branch_id
    if branch is None:
        raise HTTPException(status_code=400, detail="Select a branch before browsing the menu")
    query = query.filter(Product.branch_id == branch)

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(Product.name.ilike(like), Product.description.ilike(like)))

    if category_id:
        query = query.filter(Product.category_id == category_id)

    if category_slug:
        query = query.join(Category).filter(Category.slug == category_slug)

    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    if available_only:
        query = query.filter(Product.available == True, Product.stock > 0)  # noqa: E712

    if featured is not None:
        query = query.filter(Product.featured == featured)
    if popular is not None:
        query = query.filter(Product.popular == popular)

    if sort == "price_asc":
        query = query.order_by(asc(Product.price))
    elif sort == "price_desc":
        query = query.order_by(desc(Product.price))
    elif sort == "popular":
        query = query.order_by(desc(Product.popular), desc(Product.created_at))
    else:  # newest / default
        query = query.order_by(desc(Product.created_at))

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedProducts(
        items=[ProductOut.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, branch_id: int = Query(..., ge=1), db: Session = Depends(get_db), current_user: User | None = Depends(get_optional_user)):
    branch = current_user.branch_id if current_user and current_user.role.value == "branch_admin" else branch_id
    query = db.query(Product).options(joinedload(Product.category)).filter(Product.id == product_id)
    query = query.filter(Product.branch_id == branch)
    product = query.first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/{product_id}/related", response_model=list[ProductOut])
def get_related_products(product_id: int, limit: int = 4, branch_id: int = Query(..., ge=1), db: Session = Depends(get_db), current_user: User | None = Depends(get_optional_user)):
    branch = current_user.branch_id if current_user and current_user.role.value == "branch_admin" else branch_id
    product_query = db.query(Product).filter(Product.id == product_id)
    product_query = product_query.filter(Product.branch_id == branch)
    product = product_query.first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    related = (
        db.query(Product)
        .options(joinedload(Product.category))
        .filter(Product.category_id == product.category_id, Product.branch_id == product.branch_id, Product.id != product_id, Product.available == True)  # noqa: E712
        .limit(limit)
        .all()
    )
    return related


@router.post("", response_model=ProductOut, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db), admin: User = Depends(get_current_active_admin)):
    if not db.query(Category).filter(Category.id == payload.category_id, or_(Category.branch_id == admin.branch_id, Category.branch_id.is_(None))).first():
        raise HTTPException(status_code=400, detail="Invalid category")
    if db.query(Product).filter(Product.sku == payload.sku).first():
        raise HTTPException(status_code=400, detail="A product with this SKU already exists")

    data = payload.model_dump(exclude={"branch_id"})
    product = Product(**data, branch_id=admin.branch_id)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db), admin: User = Depends(get_current_active_admin)):
    product = db.query(Product).filter(Product.id == product_id, Product.branch_id == admin.branch_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data and not db.query(Category).filter(Category.id == data["category_id"], or_(Category.branch_id == admin.branch_id, Category.branch_id.is_(None))).first():
        raise HTTPException(status_code=400, detail="Invalid category")
    if "sku" in data:
        existing = db.query(Product).filter(Product.sku == data["sku"], Product.id != product_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="A product with this SKU already exists")

    for field, value in data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_active_admin)):
    product = db.query(Product).filter(Product.id == product_id, Product.branch_id == admin.branch_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.query(OrderItem).filter(OrderItem.product_id == product.id).update(
        {OrderItem.product_id: None},
        synchronize_session=False,
    )
    db.query(CartItem).filter(CartItem.product_id == product.id).delete(
        synchronize_session=False,
    )
    db.query(WishlistItem).filter(WishlistItem.product_id == product.id).delete(
        synchronize_session=False,
    )
    db.delete(product)
    db.commit()
    return None
