import secrets
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.address import Address
from app.models.branch import Branch
from app.models.cart import Cart, CartItem
from app.models.order import Order, OrderItem, PaymentStatus
from app.models.product import Product
from app.models.user import User, UserRole
from app.schemas.order import (
    OrderCreate,
    OrderCreatedOut,
    OrderOut,
    OrderListOut,
)
from app.dependencies.auth import get_current_user, get_optional_user
from app.services.order_number import next_order_number
from app.services.order_service import calculate_order_totals, record_promotion_redemption

router = APIRouter(prefix="/api/orders", tags=["Orders"])


@router.post("", response_model=OrderCreatedOut, status_code=201)
def place_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    if user and user.role != UserRole.customer:
        raise HTTPException(status_code=403, detail="Admin accounts cannot place customer orders")

    branch = db.query(Branch).filter(
        Branch.id == payload.branch_id,
        Branch.is_active.is_(True),
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Selected branch is unavailable")
    if payload.branch_name and payload.branch_name != branch.name:
        raise HTTPException(status_code=409, detail="Selected branch does not match the available branch")

    address = None
    if payload.address_id is not None:
        if not user:
            raise HTTPException(status_code=401, detail="Sign in to use a saved delivery address")
        address = db.query(Address).filter(
            Address.id == payload.address_id,
            Address.user_id == user.id,
        ).first()
        if not address:
            raise HTTPException(status_code=404, detail="Delivery address not found")

    cart = db.query(Cart).filter(Cart.user_id == user.id).first() if user else None
    if user and cart and cart.branch_id and cart.branch_id != branch.id and cart.items:
        raise HTTPException(status_code=409, detail="Your cart belongs to another branch")

    if user and cart:
        cart_items = (
            db.query(CartItem)
            .options(joinedload(CartItem.product))
            .filter(CartItem.cart_id == cart.id)
            .all()
        )
        if not cart_items:
            cart_items = _guest_items_from_payload(db, payload, branch.id)
    else:
        cart_items = _guest_items_from_payload(db, payload, branch.id)

    for item in cart_items:
        product = item.product
        if not product or product.branch_id != branch.id or not product.available:
            raise HTTPException(status_code=400, detail="One or more items are unavailable at the selected branch")
        if product.stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Only {product.stock} of '{product.name}' left in stock",
            )

    totals = calculate_order_totals(
        db=db,
        cart_items=cart_items,
        branch=branch,
        order_type=payload.order_type.value,
        delivery_area=payload.delivery_area,
        coupon_code=payload.coupon_code,
        user_id=user.id if user else None,
        phone=payload.phone.strip(),
    )
    customer_name = payload.customer_name.strip()
    phone = payload.phone.strip()
    delivery_address = (payload.delivery_address or "").strip() or None
    table_info = (payload.table_info or "").strip() or None
    if payload.order_type.value == "Pick-Up":
        delivery_address = f"Pick-Up from {branch.name}"
    elif payload.order_type.value == "Dine-In":
        delivery_address = f"Dine-In at {branch.name} — {table_info}"

    order = Order(
        user_id=user.id if user else None,
        branch_id=branch.id,
        branch_name=branch.name,
        order_number=next_order_number(db, branch.id),
        order_type=payload.order_type.value,
        tracking_token=secrets.token_urlsafe(32),
        address_id=address.id if address else None,
        customer_name=customer_name,
        phone=phone,
        delivery_address=delivery_address,
        delivery_area=(payload.delivery_area or "").strip() or None
        if payload.order_type.value == "Delivery" else None,
        table_info=table_info,
        instructions=(payload.instructions or "").strip() or None,
        subtotal=totals["subtotal"],
        delivery_fee=totals["delivery_fee"],
        discount=totals["discount"],
        total=totals["total"],
        promotion_name=totals["promotion_name"],
        coupon_code=totals["coupon_code"],
        payment_method=payload.payment_method,
        payment_status=PaymentStatus.pending,
    )
    db.add(order)
    db.flush()
    record_promotion_redemption(
        db,
        totals["promotion"],
        order.id,
        user.id if user else None,
        phone,
        totals["discount"],
    )

    for item in cart_items:
        product = item.product
        db.add(OrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.name,
            product_image=product.image,
            unit_price=product.effective_price,
            quantity=item.quantity,
            line_total=round(product.effective_price * item.quantity, 2),
        ))
        product.stock -= item.quantity

    if cart:
        db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
        cart.branch_id = None

    db.commit()
    db.refresh(order)
    return order


def _guest_items_from_payload(db: Session, payload: OrderCreate, branch_id: int):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Your cart is empty")

    product_ids = [item.product_id for item in payload.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="Cart contains duplicate products")
    products = {
        product.id: product
        for product in db.query(Product).filter(
            Product.id.in_(product_ids),
            Product.branch_id == branch_id,
        ).all()
    }
    if len(products) != len(product_ids):
        raise HTTPException(status_code=400, detail="One or more items are unavailable at the selected branch")

    return [
        SimpleNamespace(product=products[item.product_id], quantity=item.quantity)
        for item in payload.items
    ]


@router.get("", response_model=list[OrderListOut])
def list_my_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Order).filter(Order.user_id == user.id).order_by(Order.created_at.desc()).all()


@router.get("/track/{tracking_token}", response_model=OrderOut)
def track_guest_order(tracking_token: str, db: Session = Depends(get_db)):
    order = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.tracking_token == tracking_token)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/{order_id}", response_model=OrderOut)
def get_my_order(
    order_id: int,
    tracking_token: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    query = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id)
    if tracking_token:
        query = query.filter(Order.tracking_token == tracking_token)
    elif user:
        query = query.filter(Order.user_id == user.id)
    else:
        raise HTTPException(status_code=401, detail="Order access token is required")
    order = query.first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
