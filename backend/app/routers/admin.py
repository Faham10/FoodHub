from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import case, func, desc

from app.database import get_db
from app.models.order import Order, OrderItem, OrderStatus, PaymentStatus
from app.models.product import Product
from app.models.user import User
from app.schemas.order import OrderOut, OrderListOut, AdminOrderUpdate, OrderType
from app.schemas.product import ProductOut
from app.dependencies.auth import get_current_active_admin

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/reports")
def branch_sales_report(
    start_date: date | None = None,
    end_date: date | None = None,
    granularity: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    today = datetime.utcnow().date()
    report_start = start_date or today - timedelta(days=29)
    report_end = end_date or today
    if report_start > report_end:
        raise HTTPException(status_code=422, detail="start_date must be on or before end_date")
    if (report_end - report_start).days > 365:
        raise HTTPException(status_code=422, detail="Date range cannot exceed 366 days")

    start_at = datetime.combine(report_start, datetime.min.time())
    end_at = datetime.combine(report_end + timedelta(days=1), datetime.min.time())
    cancelled = Order.order_status == OrderStatus.cancelled
    revenue_query = db.query(
        func.count(Order.id).label("orders"),
        func.sum(case((~cancelled, Order.subtotal), else_=0)).label("gross_sales"),
        func.sum(case((~cancelled, Order.discount), else_=0)).label("discounts"),
        func.sum(case((~cancelled, Order.delivery_fee), else_=0)).label("delivery_fees"),
        func.sum(case((~cancelled, Order.total), else_=0)).label("net_revenue"),
        func.sum(case((~cancelled, 1), else_=0)).label("sales_orders"),
    ).filter(
        Order.branch_id == admin.branch_id,
        Order.created_at >= start_at,
        Order.created_at < end_at,
    ).one()

    status_counts = {
        status.value: count
        for status, count in (
            db.query(Order.order_status, func.count(Order.id))
            .filter(
                Order.branch_id == admin.branch_id,
                Order.created_at >= start_at,
                Order.created_at < end_at,
            )
            .group_by(Order.order_status)
            .all()
        )
    }
    order_type_counts = {
        order_type: count
        for order_type, count in (
            db.query(Order.order_type, func.count(Order.id))
            .filter(
                Order.branch_id == admin.branch_id,
                Order.created_at >= start_at,
                Order.created_at < end_at,
            )
            .group_by(Order.order_type)
            .all()
        )
    }

    if granularity == "daily":
        period_expression = func.date(Order.created_at)
    elif db.bind.dialect.name == "sqlite":
        period_expression = func.strftime(
            "%Y-%W" if granularity == "weekly" else "%Y-%m",
            Order.created_at,
        )
    elif granularity == "weekly":
        period_expression = func.to_char(func.date_trunc("week", Order.created_at), "YYYY-MM-DD")
    else:
        period_expression = func.to_char(func.date_trunc("month", Order.created_at), "YYYY-MM")

    series_rows = (
        db.query(
            period_expression.label("period"),
            func.count(Order.id).label("orders"),
            func.sum(case((~cancelled, Order.subtotal), else_=0)).label("gross_sales"),
            func.sum(case((~cancelled, Order.discount), else_=0)).label("discounts"),
            func.sum(case((~cancelled, Order.delivery_fee), else_=0)).label("delivery_fees"),
            func.sum(case((~cancelled, Order.total), else_=0)).label("net_revenue"),
        )
        .filter(
            Order.branch_id == admin.branch_id,
            Order.created_at >= start_at,
            Order.created_at < end_at,
        )
        .group_by(period_expression)
        .order_by(period_expression)
        .all()
    )
    best_sellers = (
        db.query(
            OrderItem.product_name,
            func.sum(OrderItem.quantity).label("quantity_sold"),
            func.sum(OrderItem.line_total).label("gross_sales"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .filter(
            Order.branch_id == admin.branch_id,
            Order.created_at >= start_at,
            Order.created_at < end_at,
            ~cancelled,
        )
        .group_by(OrderItem.product_name)
        .order_by(desc("quantity_sold"))
        .limit(10)
        .all()
    )

    sales_orders = int(revenue_query.sales_orders or 0)
    net_revenue = float(revenue_query.net_revenue or 0)
    return {
        "start_date": report_start.isoformat(),
        "end_date": report_end.isoformat(),
        "granularity": granularity,
        "revenue_definition": "Non-cancelled placed orders; net revenue is persisted order total (item subtotal minus discount plus delivery fee).",
        "total_orders": int(revenue_query.orders or 0),
        "sales_orders": sales_orders,
        "average_order_value": net_revenue / sales_orders if sales_orders else 0,
        "gross_sales": float(revenue_query.gross_sales or 0),
        "discounts": float(revenue_query.discounts or 0),
        "delivery_fees": float(revenue_query.delivery_fees or 0),
        "net_revenue": net_revenue,
        "status_counts": status_counts,
        "order_type_counts": order_type_counts,
        "series": [
            {
                "period": str(row.period),
                "orders": int(row.orders),
                "gross_sales": float(row.gross_sales or 0),
                "discounts": float(row.discounts or 0),
                "delivery_fees": float(row.delivery_fees or 0),
                "net_revenue": float(row.net_revenue or 0),
            }
            for row in series_rows
        ],
        "best_sellers": [
            {
                "name": row.product_name,
                "quantity_sold": int(row.quantity_sold),
                "gross_sales": float(row.gross_sales or 0),
            }
            for row in best_sellers
        ],
    }


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), admin: User = Depends(get_current_active_admin)):
    branch_filter = Order.branch_id == admin.branch_id
    total_orders = db.query(func.count(Order.id)).filter(branch_filter).scalar() or 0
    pending_orders = db.query(func.count(Order.id)).filter(branch_filter, Order.order_status == OrderStatus.pending).scalar() or 0
    order_type_counts = {
        order_type.value: 0
        for order_type in OrderType
    }
    for order_type, count in (
        db.query(Order.order_type, func.count(Order.id))
        .filter(branch_filter)
        .group_by(Order.order_type)
        .all()
    ):
        order_type_counts[order_type] = count
    total_revenue = (
        db.query(func.coalesce(func.sum(Order.total), 0))
        .filter(branch_filter, Order.order_status != OrderStatus.cancelled)
        .scalar()
        or 0
    )
    total_products = db.query(func.count(Product.id)).filter(Product.branch_id == admin.branch_id).scalar() or 0

    recent_orders = (
        db.query(Order).filter(branch_filter).order_by(desc(Order.created_at)).limit(8).all()
    )

    best_sellers = (
        db.query(
            OrderItem.product_name,
            func.sum(OrderItem.quantity).label("total_sold"),
            func.sum(OrderItem.line_total).label("total_revenue"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.branch_id == admin.branch_id, Order.order_status != OrderStatus.cancelled)
        .group_by(OrderItem.product_name)
        .order_by(desc("total_sold"))
        .limit(5)
        .all()
    )

    # Last 7 days sales overview
    today = datetime.utcnow().date()
    sales_overview = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_total = (
            db.query(func.coalesce(func.sum(Order.total), 0))
            .filter(func.date(Order.created_at) == day, Order.branch_id == admin.branch_id, Order.order_status != OrderStatus.cancelled)
            .scalar()
            or 0
        )
        sales_overview.append({"date": day.isoformat(), "total": float(day_total)})

    return {
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "order_type_counts": order_type_counts,
        "total_revenue": float(total_revenue),
        "total_products": total_products,
        "recent_orders": [OrderListOut.model_validate(o) for o in recent_orders],
        "best_sellers": [
            {"name": b.product_name, "quantity_sold": int(b.total_sold), "revenue": float(b.total_revenue)}
            for b in best_sellers
        ],
        "sales_overview": sales_overview,
    }


@router.get("/orders", response_model=list[OrderListOut])
def list_all_orders(
    status_filter: OrderStatus | None = Query(default=None, alias="status"),
    payment_status: PaymentStatus | None = None,
    order_type: OrderType | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    query = db.query(Order).filter(Order.branch_id == admin.branch_id)
    if status_filter:
        query = query.filter(Order.order_status == status_filter)
    if payment_status:
        query = query.filter(Order.payment_status == payment_status)
    if order_type:
        query = query.filter(Order.order_type == order_type.value)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Order.customer_name.ilike(like))
            | (Order.phone.ilike(like))
            | (Order.order_number.ilike(like))
        )
    return query.order_by(desc(Order.created_at)).all()


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order_admin(order_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_active_admin)):
    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id, Order.branch_id == admin.branch_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


VALID_TRANSITIONS = {
    OrderStatus.pending: {OrderStatus.confirmed, OrderStatus.cancelled},
    OrderStatus.confirmed: {OrderStatus.preparing, OrderStatus.cancelled},
    OrderStatus.preparing: {OrderStatus.out_for_delivery, OrderStatus.cancelled},
    OrderStatus.out_for_delivery: {OrderStatus.delivered, OrderStatus.cancelled},
    OrderStatus.delivered: set(),
    OrderStatus.cancelled: set(),
}


@router.put("/orders/{order_id}", response_model=OrderOut)
def update_order_admin(order_id: int, payload: AdminOrderUpdate, db: Session = Depends(get_db), admin: User = Depends(get_current_active_admin)):
    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id, Order.branch_id == admin.branch_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if payload.order_status is not None and payload.order_status != order.order_status:
        allowed = VALID_TRANSITIONS.get(order.order_status, set())
        if payload.order_status not in allowed and payload.order_status != order.order_status:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot change status from '{order.order_status.value}' to '{payload.order_status.value}'",
            )
        order.order_status = payload.order_status

    if payload.payment_status is not None:
        order.payment_status = payload.payment_status

    db.commit()
    db.refresh(order)
    return order


@router.get("/products", response_model=list[ProductOut])
def list_products_admin(db: Session = Depends(get_db), admin: User = Depends(get_current_active_admin)):
    return db.query(Product).options(joinedload(Product.category)).filter(Product.branch_id == admin.branch_id).order_by(desc(Product.created_at)).all()
