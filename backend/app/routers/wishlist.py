from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.wishlist import Wishlist, WishlistItem
from app.models.product import Product
from app.models.user import User
from app.schemas.wishlist import WishlistItemOut, WishlistItemCreate
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/api/wishlist", tags=["Wishlist"])


def _get_or_create_wishlist(db: Session, user: User) -> Wishlist:
    wishlist = db.query(Wishlist).filter(Wishlist.user_id == user.id).first()
    if not wishlist:
        wishlist = Wishlist(user_id=user.id)
        db.add(wishlist)
        db.commit()
        db.refresh(wishlist)
    return wishlist


@router.get("", response_model=list[WishlistItemOut])
def get_wishlist(branch_id: int | None = Query(default=None, ge=1), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    wishlist = _get_or_create_wishlist(db, user)
    query = (
        db.query(WishlistItem)
        .options(joinedload(WishlistItem.product))
        .join(Product, WishlistItem.product_id == Product.id)
        .filter(WishlistItem.wishlist_id == wishlist.id)
    )
    if branch_id is not None:
        query = query.filter(Product.branch_id == branch_id)
    return query.all()


@router.post("", response_model=WishlistItemOut, status_code=201)
def add_to_wishlist(payload: WishlistItemCreate, branch_id: int = Query(..., ge=1), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.id == payload.product_id, Product.branch_id == branch_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    wishlist = _get_or_create_wishlist(db, user)
    existing = db.query(WishlistItem).filter(WishlistItem.wishlist_id == wishlist.id, WishlistItem.product_id == payload.product_id).first()
    if existing:
        return existing

    item = WishlistItem(wishlist_id=wishlist.id, product_id=payload.product_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{product_id}", status_code=204)
def remove_from_wishlist(product_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    wishlist = _get_or_create_wishlist(db, user)
    item = db.query(WishlistItem).filter(WishlistItem.wishlist_id == wishlist.id, WishlistItem.product_id == product_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not in wishlist")
    db.delete(item)
    db.commit()
    return None
