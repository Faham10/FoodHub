from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException

from app import models
from app.database import Base
from app import database
from app.models.address import Address
from app.models.branch import Branch
from app.models.cart import Cart, CartItem
from app.models.category import Category
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.user import User, UserRole
from app.models.wishlist import Wishlist, WishlistItem
from app.routers.admin import (
    dashboard,
    get_order_admin,
    list_all_orders,
    update_order_admin,
)
from app.routers.categories import delete_category
from app.routers.orders import list_my_orders, place_order, track_guest_order
from app.routers.products import delete_product
from app.routers.wishlist import get_wishlist
from app.schemas.order import AdminOrderUpdate, OrderCreate, OrderCreatedOut, OrderType
from app.services.order_number import next_order_number


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


def create_order_for_branch(db, customer, cart, address, products, branch_id, order_type="Delivery"):
    cart.branch_id = branch_id
    product = products[branch_id]
    db.add(CartItem(cart_id=cart.id, product_id=product.id, quantity=1))
    db.flush()
    return place_order(
        OrderCreate(
            address_id=address.id,
            branch_id=branch_id,
            branch_name=f"Branch {branch_id}",
            order_type=order_type,
            customer_name=customer.full_name,
            phone=customer.phone,
            delivery_address="1 Food Street" if order_type == "Delivery" else None,
            table_info="Table 4" if order_type == "Dine-In" else None,
        ),
        db,
        customer,
    )


def test_admin_can_delete_product_while_preserving_order_history(db_session):
    db = db_session
    branches = [
        Branch(name="Delete Test Branch 1", is_active=True),
        Branch(name="Delete Test Branch 2", is_active=True),
    ]
    customer = User(
        full_name="Delete Test Customer",
        email="delete-test@example.test",
        phone="03000000000",
        hashed_password="not-used",
        role=UserRole.customer,
    )
    category = Category(name="Delete Test Meals", slug="delete-test-meals")
    db.add_all([*branches, customer, category])
    db.flush()

    product = Product(
        name="Referenced Test Product",
        price=500,
        category_id=category.id,
        branch_id=branches[0].id,
        sku="DELETE-TEST-001",
        stock=5,
    )
    other_branch_product = Product(
        name="Other Branch Test Product",
        price=600,
        category_id=category.id,
        branch_id=branches[1].id,
        sku="DELETE-TEST-002",
        stock=5,
    )
    admin = User(
        full_name="Delete Test Admin",
        email="delete-admin@example.test",
        phone="03000000001",
        hashed_password="not-used",
        role=UserRole.branch_admin,
        branch_id=branches[0].id,
    )
    db.add_all([product, other_branch_product, admin])
    db.flush()

    order = Order(
        branch_id=branches[0].id,
        order_number="B1-0001",
        branch_name=branches[0].name,
        order_type="Delivery",
        customer_name=customer.full_name,
        phone=customer.phone,
        subtotal=500,
        delivery_fee=150,
        discount=0,
        total=650,
    )
    cart = Cart(user_id=customer.id, branch_id=branches[0].id)
    wishlist = Wishlist(user_id=customer.id)
    db.add_all([order, cart, wishlist])
    db.flush()
    db.add_all([
        OrderItem(
            order_id=order.id,
            product_id=product.id,
            product_name=product.name,
            unit_price=product.price,
            quantity=1,
            line_total=product.price,
        ),
        CartItem(cart_id=cart.id, product_id=product.id, quantity=2),
        WishlistItem(wishlist_id=wishlist.id, product_id=product.id),
    ])
    db.commit()

    product_id = product.id
    other_branch_product_id = other_branch_product.id
    order_id = order.id

    with pytest.raises(HTTPException) as wrong_branch_delete:
        delete_product(other_branch_product_id, db, admin)
    assert wrong_branch_delete.value.status_code == 404
    assert db.query(Product).filter(Product.id == other_branch_product_id).first() is not None

    delete_product(product_id, db, admin)

    assert db.query(Product).filter(Product.id == product_id).first() is None
    saved_order = db.query(Order).filter(Order.id == order_id).first()
    assert saved_order is not None
    saved_item = db.query(OrderItem).filter(OrderItem.order_id == order_id).one()
    assert saved_item.product_id is None
    assert saved_item.product_name == "Referenced Test Product"
    assert saved_item.unit_price == 500
    assert db.query(CartItem).filter(CartItem.product_id == product_id).count() == 0
    assert db.query(WishlistItem).filter(WishlistItem.product_id == product_id).count() == 0


def test_admin_can_move_products_before_deleting_category(db_session):
    db = db_session
    branches = [
        Branch(name="Category Delete Branch 1", is_active=True),
        Branch(name="Category Delete Branch 2", is_active=True),
    ]
    db.add_all(branches)
    db.flush()

    source = Category(name="Old Category", slug="old-category", branch_id=branches[0].id)
    replacement = Category(name="Replacement Category", slug="replacement-category", branch_id=branches[0].id)
    other_branch_category = Category(
        name="Other Branch Category",
        slug="other-branch-category",
        branch_id=branches[1].id,
    )
    admin = User(
        full_name="Category Delete Admin",
        email="category-delete-admin@example.test",
        phone="03000000002",
        hashed_password="not-used",
        role=UserRole.branch_admin,
        branch_id=branches[0].id,
    )
    db.add_all([source, replacement, other_branch_category, admin])
    db.flush()
    product = Product(
        name="Moved Product",
        price=500,
        category_id=source.id,
        branch_id=branches[0].id,
        sku="CATEGORY-MOVE-001",
        stock=5,
    )
    db.add(product)
    db.commit()

    source_id = source.id
    replacement_id = replacement.id
    other_branch_category_id = other_branch_category.id
    product_id = product.id

    with pytest.raises(HTTPException) as wrong_branch_target:
        delete_category(source_id, other_branch_category_id, db, admin)
    assert wrong_branch_target.value.status_code == 400
    assert db.query(Category).filter(Category.id == source_id).first() is not None

    delete_category(source_id, replacement_id, db, admin)

    assert db.query(Category).filter(Category.id == source_id).first() is None
    moved_product = db.query(Product).filter(Product.id == product_id).one()
    assert moved_product.category_id == replacement_id


def test_admin_cannot_reassign_products_from_another_branch_when_deleting_shared_category(db_session):
    db = db_session
    branches = [
        Branch(name="Shared Category Branch 1", is_active=True),
        Branch(name="Shared Category Branch 2", is_active=True),
    ]
    shared_category = Category(name="Shared Category", slug="shared-category")
    db.add_all([*branches, shared_category])
    db.flush()

    admin = User(
        full_name="Shared Category Admin",
        email="shared-category-admin@example.test",
        phone="03000000003",
        hashed_password="not-used",
        role=UserRole.branch_admin,
        branch_id=branches[0].id,
    )
    products = [
        Product(
            name=f"Branch {branch.id} Product",
            price=500,
            category_id=shared_category.id,
            branch_id=branch.id,
            sku=f"SHARED-CATEGORY-{branch.id}",
            stock=5,
        )
        for branch in branches
    ]
    replacement = Category(
        name="Branch 1 Replacement",
        slug="branch-1-replacement",
        branch_id=branches[0].id,
    )
    db.add_all([admin, replacement, *products])
    db.commit()

    with pytest.raises(HTTPException) as cross_branch_delete:
        delete_category(shared_category.id, replacement.id, db, admin)

    assert cross_branch_delete.value.status_code == 400
    assert db.query(Category).filter(Category.id == shared_category.id).first() is not None
    assert all(product.category_id == shared_category.id for product in products)


def test_wishlist_can_be_loaded_without_a_selected_branch(db_session):
    db = db_session
    branches = [
        Branch(name="Wishlist Branch 1", is_active=True),
        Branch(name="Wishlist Branch 2", is_active=True),
    ]
    customer = User(
        full_name="Wishlist Customer",
        email="wishlist-customer@example.test",
        phone="03000000004",
        hashed_password="not-used",
        role=UserRole.customer,
    )
    category = Category(name="Wishlist Meals", slug="wishlist-meals")
    db.add_all([*branches, customer, category])
    db.flush()

    products = [
        Product(
            name=f"Wishlist Product {branch.id}",
            price=500,
            category_id=category.id,
            branch_id=branch.id,
            sku=f"WISHLIST-PRODUCT-{branch.id}",
            stock=5,
        )
        for branch in branches
    ]
    wishlist = Wishlist(user_id=customer.id)
    db.add_all([*products, wishlist])
    db.flush()
    items = [WishlistItem(wishlist_id=wishlist.id, product_id=product.id) for product in products]
    db.add_all(items)
    db.commit()

    all_items = get_wishlist(None, db, customer)
    branch_items = get_wishlist(branches[0].id, db, customer)

    assert {item.product_id for item in all_items} == {product.id for product in products}
    assert [item.product_id for item in branch_items] == [products[0].id]


def test_branch_orders_history_admin_stats_and_access_are_isolated(db_session):
    db = db_session
    branches = [
        Branch(name="Branch 1", is_active=True),
        Branch(name="Branch 2", is_active=True),
    ]
    db.add_all(branches)
    db.flush()
    customer = User(
        full_name="Faham Customer",
        email="faham@example.test",
        phone="03000000000",
        hashed_password="not-used",
        role=UserRole.customer,
    )
    admins = [
        User(
            full_name=f"Branch {branch.id} Admin",
            email=f"branch{branch.id}@example.test",
            phone="03000000001",
            hashed_password="not-used",
            role=UserRole.branch_admin,
            branch_id=branch.id,
        )
        for branch in branches
    ]
    category = Category(name="Meals", slug="meals", is_active=True)
    db.add_all([customer, *admins, category])
    db.flush()
    address = Address(
        user_id=customer.id,
        full_name=customer.full_name,
        phone=customer.phone,
        address_line="1 Food Street",
        city="Lahore",
    )
    products = {
        branch.id: Product(
            name=f"Meal B{branch.id}",
            price=500 if branch.id == branches[0].id else 800,
            category_id=category.id,
            branch_id=branch.id,
            sku=f"MEAL-{branch.id}",
            stock=10,
            available=True,
        )
        for branch in branches
    }
    cart = Cart(user_id=customer.id, branch_id=branches[0].id)
    db.add_all([address, *products.values(), cart])
    db.commit()

    first_branch_id, second_branch_id = (branch.id for branch in branches)
    first = create_order_for_branch(db, customer, cart, address, products, first_branch_id)
    second = create_order_for_branch(db, customer, cart, address, products, first_branch_id, "Pick-Up")
    third = create_order_for_branch(db, customer, cart, address, products, second_branch_id, "Dine-In")
    fourth = create_order_for_branch(db, customer, cart, address, products, second_branch_id)

    assert [first.order_number, second.order_number] == [
        f"B{first_branch_id}-0001",
        f"B{first_branch_id}-0002",
    ]
    assert [third.order_number, fourth.order_number] == [
        f"B{second_branch_id}-0001",
        f"B{second_branch_id}-0002",
    ]
    assert all(order.branch_id is not None for order in (first, second, third, fourth))

    update_order_admin(
        second.id,
        AdminOrderUpdate(order_status=OrderStatus.cancelled),
        db,
        admins[0],
    )
    fifth = create_order_for_branch(db, customer, cart, address, products, first_branch_id)
    assert fifth.order_number == f"B{first_branch_id}-0003"
    first_branch_orders = list_all_orders(
        status_filter=None,
        payment_status=None,
        search=None,
        db=db,
        admin=admins[0],
    )
    second_branch_orders = list_all_orders(
        status_filter=None,
        payment_status=None,
        search=None,
        db=db,
        admin=admins[1],
    )
    assert {order.id for order in first_branch_orders} == {first.id, second.id, fifth.id}
    assert {order.id for order in second_branch_orders} == {third.id, fourth.id}
    pickup_orders = list_all_orders(
        status_filter=None,
        payment_status=None,
        order_type=OrderType.pick_up,
        search=None,
        db=db,
        admin=admins[0],
    )
    dine_in_orders = list_all_orders(
        status_filter=None,
        payment_status=None,
        order_type=OrderType.dine_in,
        search=None,
        db=db,
        admin=admins[1],
    )
    assert [order.id for order in pickup_orders] == [second.id]
    assert [order.id for order in dine_in_orders] == [third.id]
    assert list_all_orders(
        status_filter=None,
        payment_status=None,
        search=f"B{second_branch_id}-",
        db=db,
        admin=admins[0],
    ) == []

    first_stats = dashboard(db=db, admin=admins[0])
    second_stats = dashboard(db=db, admin=admins[1])
    assert first_stats["total_orders"] == 3
    assert first_stats["total_revenue"] == pytest.approx(first.total + fifth.total)
    assert first_stats["order_type_counts"] == {
        "Delivery": 2,
        "Pick-Up": 1,
        "Dine-In": 0,
    }
    assert second_stats["total_orders"] == 2
    assert second_stats["total_revenue"] == pytest.approx(third.total + fourth.total)
    assert second_stats["order_type_counts"] == {
        "Delivery": 1,
        "Pick-Up": 0,
        "Dine-In": 1,
    }

    with pytest.raises(HTTPException) as forbidden_order:
        get_order_admin(third.id, db=db, admin=admins[0])
    assert forbidden_order.value.status_code == 404
    with pytest.raises(HTTPException) as forbidden_update:
        update_order_admin(
            third.id,
            AdminOrderUpdate(order_status=OrderStatus.confirmed),
            db,
            admins[0],
        )
    assert forbidden_update.value.status_code == 404

    customer_history = list_my_orders(db=db, user=customer)
    assert {order.id for order in customer_history} == {
        first.id,
        second.id,
        third.id,
        fourth.id,
        fifth.id,
    }
    assert {order.branch_id for order in customer_history} == {first_branch_id, second_branch_id}


def test_branch_order_numbers_are_unique_under_concurrent_creation(tmp_path):
    database_file = tmp_path / "branch-sequences.sqlite"
    engine = create_engine(
        f"sqlite:///{database_file}",
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    Base.metadata.create_all(bind=engine)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        branch = Branch(name="Concurrent Branch", is_active=True)
        db.add(branch)
        db.commit()
        branch_id = branch.id

    def reserve_number(_):
        with sessions() as db:
            number = next_order_number(db, branch_id)
            db.commit()
            return number

    try:
        with ThreadPoolExecutor(max_workers=8) as executor:
            numbers = list(executor.map(reserve_number, range(24)))
        assert len(set(numbers)) == 24
        assert set(numbers) == {f"B{branch_id}-{value:04d}" for value in range(1, 25)}
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_legacy_orders_are_backfilled_to_their_product_branch(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    sessions = sessionmaker(bind=engine)
    with sessions() as db:
        branches = [
            Branch(name="Branch 1", is_active=True),
            Branch(name="Branch 2", is_active=True),
        ]
        customer = User(
            full_name="Legacy Customer",
            email="legacy@example.test",
            phone="03000000000",
            hashed_password="not-used",
            role=UserRole.customer,
        )
        category = Category(name="Legacy Meals", slug="legacy-meals")
        db.add_all([*branches, customer, category])
        db.flush()
        products = [
            Product(
                name=f"Legacy Meal B{branch.id}",
                price=500,
                category_id=category.id,
                branch_id=branch.id,
                sku=f"LEGACY-{branch.id}",
                stock=5,
            )
            for branch in branches
        ]
        db.add_all(products)
        db.commit()
        branch_ids = [branch.id for branch in branches]
        customer_id = customer.id
        product_ids = [product.id for product in products]

    with engine.begin() as connection:
        connection.execute(text("DROP TABLE orders"))
        connection.execute(text(
            "CREATE TABLE orders ("
            "id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, branch_id INTEGER, "
            "address_id INTEGER, customer_name VARCHAR(120) NOT NULL, "
            "phone VARCHAR(30) NOT NULL, delivery_address TEXT NOT NULL, "
            "subtotal NUMERIC(10, 2) NOT NULL, delivery_fee NUMERIC(10, 2), "
            "discount NUMERIC(10, 2), total NUMERIC(10, 2) NOT NULL, "
            "payment_method VARCHAR(20), payment_status VARCHAR(20), "
            "order_status VARCHAR(30), created_at DATETIME, updated_at DATETIME)"
        ))
        for order_id, product_id in enumerate(product_ids, start=1):
            connection.execute(
                text(
                    "INSERT INTO orders "
                    "(id, user_id, customer_name, phone, delivery_address, subtotal, total, "
                    "payment_method, payment_status, order_status) "
                    "VALUES (:id, :user_id, 'Legacy Customer', '03000000000', "
                    "'Legacy address', 500, 650, 'cod', 'pending', 'pending')"
                ),
                {"id": order_id, "user_id": customer_id},
            )
            connection.execute(
                text(
                    "INSERT INTO order_items "
                    "(order_id, product_id, product_name, unit_price, quantity, line_total) "
                    "VALUES (:order_id, :product_id, 'Legacy Meal', 500, 1, 500)"
                ),
                {"order_id": order_id, "product_id": product_id},
            )

    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(database, "SessionLocal", sessions)
    try:
        database.ensure_branch_schema()
        with sessions() as db:
            legacy_orders = db.query(Order).order_by(Order.id).all()
            assert [order.branch_id for order in legacy_orders] == branch_ids
            assert [order.order_number for order in legacy_orders] == [
                f"B{branch_ids[0]}-0001",
                f"B{branch_ids[1]}-0001",
            ]
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_guest_checkout_creates_order_with_private_tracking_and_type(db_session):
    db = db_session
    branch = Branch(name="Guest Branch", is_active=True)
    db.add(branch)
    db.flush()
    category = Category(name="Guest Meals", slug="guest-meals")
    db.add(category)
    db.flush()
    product = Product(
        name="Guest Meal",
        price=800,
        category_id=category.id,
        branch_id=branch.id,
        sku="GUEST-001",
        stock=5,
        available=True,
    )
    db.add(product)
    db.commit()

    order = place_order(
        OrderCreate(
            branch_id=branch.id,
            branch_name=branch.name,
            order_type="Dine-In",
            customer_name="Guest Customer",
            phone="03001234567",
            table_info="Table 8",
            instructions="No onions",
            items=[{"product_id": product.id, "quantity": 2}],
        ),
        db=db,
        user=None,
    )

    assert order.user_id is None
    assert order.branch_id == branch.id
    assert order.branch_name == branch.name
    assert order.order_type == "Dine-In"
    assert order.table_info == "Table 8"
    assert order.instructions == "No onions"
    assert order.total == 1600
    assert order.tracking_token
    response = OrderCreatedOut.model_validate(order)
    assert response.order_number == order.order_number
    assert response.order_type == OrderType.dine_in
    assert track_guest_order(response.tracking_token, db).id == order.id
    with pytest.raises(HTTPException) as invalid_tracking:
        track_guest_order("not-a-valid-token", db)
    assert invalid_tracking.value.status_code == 404


def test_legacy_branch_rename_preserves_branch_ids_and_updates_order_labels(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    sessions = sessionmaker(bind=engine)
    try:
        with sessions() as db:
            branches = [
                Branch(name="Branch 1", is_active=True),
                Branch(name="Branch 2", is_active=True),
            ]
            db.add_all(branches)
            db.flush()
            branch_ids = [branch.id for branch in branches]
            db.add_all(
                [
                    Order(
                        branch_id=branch.id,
                        order_number=f"B{branch.id}-0001",
                        branch_name=branch.name,
                        customer_name="Legacy Customer",
                        phone="03000000000",
                        subtotal=500,
                        total=500,
                    )
                    for branch in branches
                ]
            )
            db.commit()

        monkeypatch.setattr(database, "SessionLocal", sessions)
        database.rename_legacy_branches()

        with sessions() as db:
            branches = db.query(Branch).order_by(Branch.id).all()
            orders = db.query(Order).order_by(Order.id).all()
            assert [branch.id for branch in branches] == branch_ids
            assert [branch.name for branch in branches] == ["Kallu Chock", "Kornagi 2"]
            assert [order.branch_id for order in orders] == branch_ids
            assert [order.branch_name for order in orders] == ["Kallu Chock", "Kornagi 2"]
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
