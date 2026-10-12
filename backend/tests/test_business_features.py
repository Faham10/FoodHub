import json
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, ensure_legacy_discount_promotions
from app.models.branch import Branch
from app.models.category import Category
from app.models.order import OrderStatus
from app.models.product import Product
from app.models.promotion import Promotion, PromotionRedemption
from app.models.user import User, UserRole
from app.routers.admin import branch_sales_report
from app.routers.branches import DeliverySettingsUpdate, update_admin_delivery_settings
from app.routers.orders import place_order
from app.routers.promotions import (
    archive_promotion,
    create_promotion,
    list_admin_promotions,
    list_customer_promotions,
    update_promotion,
)
from app.schemas.order import AdminOrderUpdate, OrderCreate
from app.schemas.promotion import PromotionCreate, PromotionUpdate
from app.routers.admin import update_order_admin


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def make_checkout_fixture(db):
    branches = [
        Branch(name="Feature Branch 1", is_active=True),
        Branch(name="Feature Branch 2", is_active=True),
    ]
    category = Category(name="Feature Meals", slug="feature-meals")
    db.add_all([*branches, category])
    db.flush()
    products = [
        Product(
            name=f"Feature Meal {branch.id}",
            price=500,
            category_id=category.id,
            branch_id=branch.id,
            sku=f"FEATURE-MEAL-{branch.id}",
            stock=10,
            available=True,
        )
        for branch in branches
    ]
    admins = [
        User(
            full_name=f"Feature Admin {branch.id}",
            email=f"feature-admin-{branch.id}@example.test",
            phone=f"0300000000{branch.id}",
            hashed_password="not-used",
            role=UserRole.branch_admin,
            branch_id=branch.id,
        )
        for branch in branches
    ]
    db.add_all([*products, *admins])
    db.commit()
    return branches, products, admins


def make_order(branch, product, order_type="Delivery", **extra):
    return OrderCreate(
        branch_id=branch.id,
        branch_name=branch.name,
        order_type=order_type,
        customer_name="Feature Customer",
        phone="03001234567",
        delivery_address="House 1, Test Street" if order_type == "Delivery" else None,
        delivery_area=extra.get("delivery_area"),
        coupon_code=extra.get("coupon_code"),
        items=[{"product_id": product.id, "quantity": extra.get("quantity", 1)}],
        table_info="Table 1" if order_type == "Dine-In" else None,
    )


def test_coupon_limits_discount_history_and_branch_isolation(db_session):
    db = db_session
    branches, products, admins = make_checkout_fixture(db)
    branches[0].delivery_areas = json.dumps(["Korangi"])
    promotion = Promotion(
        branch_id=branches[0].id,
        name="Ten percent",
        discount_type="percentage",
        discount_value=10,
        coupon_code="SAVE10",
        maximum_discount=40,
        usage_limit=1,
        per_customer_limit=1,
        starts_at=datetime.utcnow() - timedelta(days=1),
        ends_at=datetime.utcnow() + timedelta(days=1),
        is_active=True,
    )
    db.add(promotion)
    db.commit()

    order = place_order(
        make_order(branches[0], products[0], delivery_area="Korangi", coupon_code="save10"),
        db,
        None,
    )
    assert order.subtotal == Decimal("500.00")
    assert order.delivery_fee == Decimal("150.00")
    assert order.discount == Decimal("40.00")
    assert order.total == Decimal("610.00")
    assert order.coupon_code == "SAVE10"
    assert order.promotion_name == "Ten percent"
    assert db.query(PromotionRedemption).filter_by(order_id=order.id).count() == 1
    assert promotion.usage_count == 1

    with pytest.raises(HTTPException, match="usage limit|already used"):
        place_order(
            make_order(branches[0], products[0], delivery_area="Korangi", coupon_code="SAVE10"),
            db,
            None,
        )
    with pytest.raises(HTTPException, match="invalid or unavailable"):
        place_order(
            make_order(branches[1], products[1], coupon_code="SAVE10"),
            db,
            None,
        )
    with pytest.raises(HTTPException, match="not supported"):
        place_order(make_order(branches[0], products[0], delivery_area="Other"), db, None)

    assert list_admin_promotions(db, admins[0])[0].id == promotion.id
    assert list_admin_promotions(db, admins[1]) == []
    with pytest.raises(HTTPException) as cross_branch_archive:
        archive_promotion(promotion.id, db, admins[1])
    assert cross_branch_archive.value.status_code == 404
    assert promotion.is_active


def test_coupon_expiry_inactive_and_repeat_customer_limits(db_session):
    db = db_session
    branches, products, _ = make_checkout_fixture(db)
    now = datetime.utcnow()
    promotions = [
        Promotion(
            branch_id=branches[0].id,
            name="Expired coupon",
            discount_type="fixed",
            discount_value=100,
            coupon_code="EXPIRED",
            ends_at=now - timedelta(days=1),
            is_active=True,
        ),
        Promotion(
            branch_id=branches[0].id,
            name="Paused coupon",
            discount_type="fixed",
            discount_value=100,
            coupon_code="PAUSED",
            is_active=False,
        ),
        Promotion(
            branch_id=branches[0].id,
            name="Future coupon",
            discount_type="fixed",
            discount_value=100,
            coupon_code="FUTURE",
            starts_at=now + timedelta(days=1),
            is_active=True,
        ),
        Promotion(
            branch_id=branches[0].id,
            name="Minimum coupon",
            discount_type="fixed",
            discount_value=100,
            coupon_code="MINIMUM",
            minimum_order_amount=700,
            is_active=True,
        ),
        Promotion(
            branch_id=branches[0].id,
            name="One use",
            discount_type="fixed",
            discount_value=100,
            coupon_code="ONCE",
            usage_limit=5,
            per_customer_limit=1,
            is_active=True,
        ),
    ]
    db.add_all(promotions)
    db.commit()

    for code in ("EXPIRED", "PAUSED", "FUTURE", "MISSING"):
        with pytest.raises(HTTPException, match="invalid or unavailable"):
            place_order(make_order(branches[0], products[0], "Pick-Up", coupon_code=code), db, None)
    with pytest.raises(HTTPException, match="minimum amount"):
        place_order(make_order(branches[0], products[0], "Pick-Up", coupon_code="MINIMUM"), db, None)

    place_order(make_order(branches[0], products[0], "Pick-Up", coupon_code="ONCE"), db, None)
    with pytest.raises(HTTPException, match="already used"):
        place_order(make_order(branches[0], products[0], "Pick-Up", coupon_code="ONCE"), db, None)


def test_branch_deal_crud_and_automatic_application(db_session):
    db = db_session
    branches, products, admins = make_checkout_fixture(db)
    deal = create_promotion(
        PromotionCreate(
            name="Branch One Special",
            discount_type="fixed",
            discount_value=100,
            applicable_product_ids=[products[0].id],
        ),
        db,
        admins[0],
    )
    assert deal.branch_id == branches[0].id
    assert [item["id"] for item in list_customer_promotions(branches[0].id, db)] == [deal.id]
    assert list_customer_promotions(branches[1].id, db) == []

    branch_one_order = place_order(make_order(branches[0], products[0], "Pick-Up"), db, None)
    branch_two_order = place_order(make_order(branches[1], products[1], "Pick-Up"), db, None)
    assert branch_one_order.discount == Decimal("100.00")
    assert branch_one_order.promotion_name == "Branch One Special"
    assert branch_two_order.discount == Decimal("0.00")

    update_promotion(deal.id, PromotionUpdate(is_active=False), db, admins[0])
    with pytest.raises(HTTPException) as cross_branch_edit:
        update_promotion(deal.id, PromotionUpdate(name="Takeover"), db, admins[1])
    assert cross_branch_edit.value.status_code == 404
    inactive_order = place_order(make_order(branches[0], products[0], "Pick-Up"), db, None)
    assert inactive_order.discount == Decimal("0.00")


def test_checkout_ignores_client_submitted_prices_and_totals(db_session):
    db = db_session
    branches, products, _ = make_checkout_fixture(db)
    client_payload = make_order(branches[0], products[0]).model_dump()
    client_payload.update({
        "subtotal": 1,
        "delivery_fee": 0,
        "discount": 500,
        "total": 1,
    })
    client_payload["items"] = [{
        "product_id": products[0].id,
        "quantity": 1,
        "unit_price": 0.01,
        "line_total": 0.01,
    }]
    order = place_order(OrderCreate.model_validate(client_payload), db, None)
    assert order.subtotal == Decimal("500.00")
    assert order.delivery_fee == Decimal("150.00")
    assert order.discount == Decimal("0.00")
    assert order.total == Decimal("650.00")
    assert order.items[0].unit_price == Decimal("500.00")


def test_existing_cart_discount_is_migrated_once_per_branch(db_session):
    db = db_session
    branches, products, _ = make_checkout_fixture(db)
    ensure_legacy_discount_promotions(db)
    ensure_legacy_discount_promotions(db)

    assert db.query(Promotion).filter_by(system_key="legacy-cart-discount").count() == 2
    order = place_order(
        make_order(branches[0], products[0], "Pick-Up", quantity=4),
        db,
        None,
    )
    assert order.subtotal == Decimal("2000.00")
    assert order.discount == Decimal("100.00")
    assert order.total == Decimal("1900.00")


def test_branch_delivery_settings_and_non_delivery_order_pricing(db_session):
    db = db_session
    branches, products, admins = make_checkout_fixture(db)
    payload = DeliverySettingsUpdate(
        delivery_enabled=True,
        delivery_fee=Decimal("220"),
        free_delivery_threshold=Decimal("1000"),
        minimum_order_amount=Decimal("600"),
        delivery_areas=["Korangi", "Landhi"],
    )
    updated = update_admin_delivery_settings(payload, db, admins[0])
    assert updated["delivery_fee"] == 220
    assert updated["delivery_areas"] == ["Korangi", "Landhi"]
    assert branches[1].delivery_fee == Decimal("150.00")

    free_delivery_order = place_order(
        make_order(branches[0], products[0], delivery_area="Korangi", quantity=2),
        db,
        None,
    )
    assert free_delivery_order.delivery_fee == Decimal("0.00")
    assert free_delivery_order.total == Decimal("1000.00")
    branches[0].delivery_fee = Decimal("990")
    db.commit()
    db.refresh(free_delivery_order)
    assert free_delivery_order.delivery_fee == Decimal("0.00")
    assert free_delivery_order.total == Decimal("1000.00")

    with pytest.raises(HTTPException, match="minimum order"):
        place_order(
            make_order(branches[0], products[0], delivery_area="Korangi"),
            db,
            None,
        )

    pickup = place_order(make_order(branches[0], products[0], "Pick-Up"), db, None)
    dine_in = place_order(make_order(branches[1], products[1], "Dine-In"), db, None)
    assert pickup.delivery_fee == Decimal("0.00")
    assert dine_in.delivery_fee == Decimal("0.00")
    assert pickup.total == Decimal("500.00")
    assert dine_in.total == Decimal("500.00")


def test_branch_sales_report_filters_dates_cancellations_and_branch_data(db_session):
    db = db_session
    branches, products, admins = make_checkout_fixture(db)
    first = place_order(make_order(branches[0], products[0], "Pick-Up"), db, None)
    second = place_order(make_order(branches[1], products[1], "Pick-Up"), db, None)
    update_order_admin(
        first.id,
        AdminOrderUpdate(order_status=OrderStatus.cancelled),
        db,
        admins[0],
    )

    today = datetime.utcnow().date()
    first_report = branch_sales_report(today, today, "daily", db, admins[0])
    second_report = branch_sales_report(today, today, "weekly", db, admins[1])
    assert first_report["total_orders"] == 1
    assert first_report["sales_orders"] == 0
    assert first_report["net_revenue"] == 0
    assert first_report["status_counts"] == {"Cancelled": 1}
    assert first_report["best_sellers"] == []
    assert second_report["total_orders"] == 1
    assert second_report["net_revenue"] == pytest.approx(500)
    assert second_report["best_sellers"][0]["name"] == products[1].name
    assert second_report["series"][0]["net_revenue"] == pytest.approx(second.total)
    monthly_report = branch_sales_report(today, today, "monthly", db, admins[1])
    assert monthly_report["series"][0]["period"] == today.strftime("%Y-%m")

    with pytest.raises(HTTPException) as invalid_range:
        branch_sales_report(today, today - timedelta(days=1), "daily", db, admins[0])
    assert invalid_range.value.status_code == 422

    empty_report = branch_sales_report(
        today - timedelta(days=1),
        today - timedelta(days=1),
        "daily",
        db,
        admins[0],
    )
    assert empty_report["total_orders"] == 0
    assert empty_report["average_order_value"] == 0
