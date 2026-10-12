from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.cart import Cart, CartItem
from app.models.product import Product
from app.models.user import User
from app.schemas.cart import CartOut, CartItemOut, CartItemCreate, CartItemUpdate
from app.dependencies.auth import get_current_user
from app.services.order_service import calculate_totals

router = APIRouter(prefix="/api/cart", tags=["Cart"])


def _get_or_create_cart(db: Session, user: User) -> Cart:
    cart = db.query(Cart).filter(Cart.user_id == user.id).first()
    if not cart:
        cart = Cart(user_id=user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def _serialize(db: Session, cart: Cart) -> CartOut:
    items = (
        db.query(CartItem)
        .options(joinedload(CartItem.product))
        .filter(CartItem.cart_id == cart.id)
        .all()
    )
    totals = calculate_totals(items)
    item_outs = [
        CartItemOut(
            id=i.id,
            product=i.product,
            quantity=i.quantity,
            line_total=round(i.product.effective_price * i.quantity, 2),
        )
        for i in items
    ]
    return CartOut(items=item_outs, branch_id=cart.branch_id, **totals)


@router.get("", response_model=CartOut)
def get_cart(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cart = _get_or_create_cart(db, user)
    return _serialize(db, cart)


@router.post("/items", response_model=CartOut, status_code=201)
def add_item(payload: CartItemCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.id == payload.product_id, Product.branch_id == payload.branch_id).first()
    if not product or not product.available:
        raise HTTPException(status_code=404, detail="Product not available")

    cart = _get_or_create_cart(db, user)
    if cart.branch_id and cart.branch_id != payload.branch_id and cart.items:
        raise HTTPException(status_code=409, detail="Your cart belongs to another branch. Clear it before switching branches.")
    if cart.branch_id != payload.branch_id:
        cart.branch_id = payload.branch_id
    item = db.query(CartItem).filter(CartItem.cart_id == cart.id, CartItem.product_id == payload.product_id).first()
    if item:
        item.quantity += payload.quantity
    else:
        item = CartItem(cart_id=cart.id, product_id=payload.product_id, quantity=payload.quantity)
        db.add(item)

    if item.quantity > product.stock and product.stock > 0:
        item.quantity = product.stock

    db.commit()
    return _serialize(db, cart)


@router.put("/items/{item_id}", response_model=CartOut)
def update_item(item_id: int, payload: CartItemUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cart = _get_or_create_cart(db, user)
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.cart_id == cart.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    item.quantity = payload.quantity
    db.commit()
    return _serialize(db, cart)


@router.delete("/items/{item_id}", response_model=CartOut)
def remove_item(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cart = _get_or_create_cart(db, user)
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.cart_id == cart.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    db.delete(item)
    db.commit()
    return _serialize(db, cart)


@router.delete("", response_model=CartOut)
def clear_cart(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cart = _get_or_create_cart(db, user)
    db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
    cart.branch_id = None
    db.commit()
    return _serialize(db, cart)
