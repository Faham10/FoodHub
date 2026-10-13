import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.branch import Branch
from app.models.category import Category
from app.models.order import Order
from app.models.product import Product
from app.models.user import User, UserRole
from app.seed import (
    BRANCH_NAMES,
    CATEGORIES,
    PRODUCTS,
    CatalogInitializationConflict,
    initialize_catalog_once,
)


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


def add_expected_branches(db):
    branches = {
        name: Branch(name=name, is_active=True)
        for name in BRANCH_NAMES.values()
    }
    db.add_all(branches.values())
    db.flush()
    return branches


def test_initializes_catalog_once_with_branch_isolation(db_session):
    db = db_session
    branches = add_expected_branches(db)

    assert initialize_catalog_once(db) == (len(CATEGORIES), len(PRODUCTS))
    assert db.query(Category).count() == 12
    assert db.query(Product).count() == 34
    for index, (_, _, _, _, _, sku, _, _, _) in enumerate(PRODUCTS):
        expected_name = BRANCH_NAMES["Branch 1" if index % 2 == 0 else "Branch 2"]
        product = db.query(Product).filter(Product.sku == sku).one()
        assert product.branch_id == branches[expected_name].id
    assert db.query(Product).filter(
        Product.branch_id == branches[BRANCH_NAMES["Branch 1"]].id
    ).count() == 17
    assert db.query(Product).filter(
        Product.branch_id == branches[BRANCH_NAMES["Branch 2"]].id
    ).count() == 17

    assert initialize_catalog_once(db) is None
    assert db.query(Category).count() == 12
    assert db.query(Product).count() == 34


def test_preserves_existing_matching_product_without_overwriting(db_session):
    db = db_session
    branches = add_expected_branches(db)
    category = Category(name="Burgers", slug="burgers", is_active=True)
    db.add(category)
    db.flush()
    product = Product(
        name="Existing custom product",
        price=999,
        category_id=category.id,
        branch_id=branches[BRANCH_NAMES["Branch 1"]].id,
        sku="BUR-001",
        stock=2,
        available=False,
    )
    db.add(product)
    db.flush()

    assert initialize_catalog_once(db) == (len(CATEGORIES) - 1, len(PRODUCTS) - 1)

    saved = db.query(Product).filter(Product.sku == "BUR-001").one()
    assert (saved.name, saved.price, saved.stock, saved.available) == (
        "Existing custom product",
        999,
        2,
        False,
    )


@pytest.mark.parametrize(
    "conflict",
    [
        "unexpected_branch",
        "unassigned_admin",
        "unassigned_product",
        "invalid_category",
        "inconsistent_order",
        "wrong_branch_sku",
    ],
)
def test_conflicts_abort_before_catalog_changes(db_session, conflict):
    db = db_session
    branches = add_expected_branches(db)

    if conflict == "unexpected_branch":
        db.add(Branch(name="Unexpected Branch", is_active=True))
    elif conflict == "unassigned_admin":
        db.add(User(
            full_name="Unassigned Admin",
            email="unassigned-admin@example.test",
            phone="03000000000",
            hashed_password="not-used",
            role=UserRole.branch_admin,
            branch_id=None,
        ))
    elif conflict == "unassigned_product":
        category = Category(name="Existing", slug="existing")
        db.add(category)
        db.flush()
        db.add(Product(
            name="Unassigned",
            price=500,
            category_id=category.id,
            branch_id=None,
            sku="EXISTING-001",
        ))
    elif conflict == "invalid_category":
        db.add(Category(
            name="Burgers",
            slug="burgers",
            branch_id=branches[BRANCH_NAMES["Branch 1"]].id,
        ))
    elif conflict == "inconsistent_order":
        db.add(Order(
            branch_id=branches[BRANCH_NAMES["Branch 1"]].id,
            order_number="B1-0001",
            branch_name="Unknown Branch",
            customer_name="Test",
            phone="03000000000",
            subtotal=500,
            total=500,
        ))
    else:
        category = Category(name="Burgers", slug="burgers")
        db.add(category)
        db.flush()
        db.add(Product(
            name="Misassigned seed SKU",
            price=650,
            category_id=category.id,
            branch_id=branches[BRANCH_NAMES["Branch 2"]].id,
            sku="BUR-001",
        ))
    db.flush()
    db.commit()

    with pytest.raises(CatalogInitializationConflict):
        initialize_catalog_once(db)

    assert db.query(Category).count() == (
        0 if conflict in {"unexpected_branch", "unassigned_admin", "inconsistent_order"} else 1
    )
    assert db.query(Product).count() == (
        1 if conflict in {"unassigned_product", "wrong_branch_sku"} else 0
    )
    assert not inspect(db.connection()).has_table("foodhub_initializations")
