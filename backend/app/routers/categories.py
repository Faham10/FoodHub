import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.database import get_db
from app.models.category import Category
from app.models.product import Product
from app.models.user import User
from app.schemas.category import CategoryOut, CategoryCreate, CategoryUpdate
from app.dependencies.auth import get_current_active_admin, get_optional_user

router = APIRouter(prefix="/api/categories", tags=["Categories"])


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _with_count(db: Session, category: Category, branch_id: int | None = None) -> CategoryOut:
    query = db.query(func.count(Product.id)).filter(Product.category_id == category.id)
    if branch_id is not None:
        query = query.filter(Product.branch_id == branch_id)
    count = query.scalar() or 0
    out = CategoryOut.model_validate(category)
    out.product_count = count
    return out


@router.get("", response_model=list[CategoryOut])
def list_categories(active_only: bool = False, branch_categories_only: bool = False, branch_id: int | None = Query(default=None, ge=1), db: Session = Depends(get_db), current_user: User | None = Depends(get_optional_user)):
    query = db.query(Category)
    branch = current_user.branch_id if current_user and current_user.role.value == "branch_admin" else branch_id
    if branch is None:
        raise HTTPException(status_code=400, detail="Select a branch before browsing categories")
    query = query.filter(Category.branch_id == branch if branch_categories_only else or_(Category.branch_id == branch, Category.branch_id.is_(None)))
    if active_only:
        query = query.filter(Category.is_active == True)  # noqa: E712
    categories = query.order_by(Category.name).all()
    return [_with_count(db, c, branch) for c in categories]


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(category_id: int, branch_id: int | None = Query(default=None, ge=1), db: Session = Depends(get_db), current_user: User | None = Depends(get_optional_user)):
    branch = current_user.branch_id if current_user and current_user.role.value == "branch_admin" else branch_id
    category = db.query(Category).filter(Category.id == category_id, or_(Category.branch_id == branch, Category.branch_id.is_(None))).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return _with_count(db, category, branch)


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), admin: User = Depends(get_current_active_admin)):
    slug = slugify(payload.name)
    if db.query(Category).filter(Category.slug == slug, Category.branch_id == admin.branch_id).first():
        raise HTTPException(status_code=400, detail="A category with this name already exists")
    category = Category(name=payload.name, slug=slug, image=payload.image, is_active=payload.is_active, branch_id=admin.branch_id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return _with_count(db, category, admin.branch_id)


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db), admin: User = Depends(get_current_active_admin)):
    category = db.query(Category).filter(
        Category.id == category_id,
        or_(Category.branch_id == admin.branch_id, Category.branch_id.is_(None)),
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        category.slug = slugify(data["name"])
    for field, value in data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)
    return _with_count(db, category, admin.branch_id)


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    replacement_category_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    category = db.query(Category).filter(
        Category.id == category_id,
        or_(Category.branch_id == admin.branch_id, Category.branch_id.is_(None)),
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    products = db.query(Product).filter(Product.category_id == category_id).all()
    if products:
        if replacement_category_id is None:
            raise HTTPException(
                status_code=400,
                detail=f"Choose another category for the {len(products)} products before deleting this category.",
            )

        replacement = db.query(Category).filter(
            Category.id == replacement_category_id,
            or_(Category.branch_id == admin.branch_id, Category.branch_id.is_(None)),
        ).first()
        if not replacement or replacement.id == category.id:
            raise HTTPException(status_code=400, detail="Choose a different category available to your branch")

        if any(product.branch_id != admin.branch_id for product in products):
            raise HTTPException(
                status_code=400,
                detail="This category is used by products outside your branch. Ask the other branch admin to move their products first.",
            )

        db.query(Product).filter(Product.category_id == category_id).update(
            {Product.category_id: replacement.id},
            synchronize_session=False,
        )

    db.delete(category)
    db.commit()
    return None
