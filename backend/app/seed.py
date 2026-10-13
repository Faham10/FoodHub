"""
Seed the database with two branches, branch-assigned categories/products and two branch-admin accounts.

Run with:
    python -m app.seed
"""
import re

from sqlalchemy import func, inspect, or_, text
from sqlalchemy.orm import Session

from app.database import Base, engine, SessionLocal, ensure_branch_schema
from app import models  # noqa: F401  (ensures all models are registered)
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.product import Product
from app.models.branch import Branch
from app.models.order import Order
from app.utils.security import hash_password
from app.config import settings


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


CATEGORIES = [
    "Burgers", "Pizza", "Fries", "Shawarma", "Chicken",
    "Sandwiches", "Nuggets", "Wings", "Rolls", "Drinks",
    "Desserts", "Deals",
]

BRANCH_NAMES = {
    "Branch 1": "Kallu Chock",
    "Branch 2": "Kornagi 2",
}

# (name, description, price, sale_price, category, sku, stock, featured, popular)
PRODUCTS = [
    ("Classic Zinger Burger", "Crispy fried chicken fillet, lettuce and mayo in a soft bun.", 650, 550, "Burgers", "BUR-001", 120, True, True),
    ("Beef Smash Burger", "Juicy smashed beef patty with melted cheddar and special sauce.", 750, None, "Burgers", "BUR-002", 90, True, True),
    ("Chicken Cheese Burger", "Grilled chicken patty topped with double cheese.", 600, 520, "Burgers", "BUR-003", 100, False, True),
    ("Spicy Zinger Deluxe", "Extra spicy crispy fillet with jalapenos and chipotle mayo.", 700, None, "Burgers", "BUR-004", 80, False, False),
    ("Chicken Fajita Pizza", "Loaded with grilled chicken fajita, peppers and mozzarella.", 1450, 1250, "Pizza", "PIZ-001", 60, True, True),
    ("Pepperoni Pizza", "Classic pepperoni with extra cheese on a hand-tossed crust.", 1350, None, "Pizza", "PIZ-002", 70, True, True),
    ("Behari Boti Pizza", "Spicy behari boti chunks with onions and mozzarella.", 1500, 1300, "Pizza", "PIZ-003", 50, False, False),
    ("Veggie Supreme Pizza", "Loaded with bell peppers, olives, mushrooms and corn.", 1250, None, "Pizza", "PIZ-004", 45, False, False),
    ("Loaded Fries", "Crispy fries topped with cheese sauce, jalapenos and beef bits.", 550, None, "Fries", "FRI-001", 100, True, True),
    ("Peri Peri Fries", "Crunchy fries tossed in tangy peri peri seasoning.", 380, None, "Fries", "FRI-002", 150, False, True),
    ("Classic Salted Fries", "Golden fries with a pinch of sea salt.", 300, None, "Fries", "FRI-003", 200, False, False),
    ("Chicken Shawarma", "Grilled chicken strips wrapped with garlic sauce and pickles.", 350, None, "Shawarma", "SHW-001", 140, True, True),
    ("Beef Shawarma", "Tender beef strips wrapped with tahini and fresh veggies.", 400, None, "Shawarma", "SHW-002", 100, False, False),
    ("Shawarma Platter", "Two shawarma rolls served with fries and a drink.", 850, 750, "Shawarma", "SHW-003", 60, True, False),
    ("Crispy Chicken", "2-piece crispy fried chicken with signature spice blend.", 500, None, "Chicken", "CHK-001", 90, True, True),
    ("Broast Chicken (4pc)", "Family-style broasted chicken, 4 juicy pieces.", 1100, 950, "Chicken", "CHK-002", 50, False, True),
    ("Grilled Chicken Half", "Charcoal grilled half chicken with herb marinade.", 950, None, "Chicken", "CHK-003", 40, False, False),
    ("Chicken Cheese Sandwich", "Grilled chicken and cheese between toasted bread.", 420, None, "Sandwiches", "SND-001", 100, False, False),
    ("Club Sandwich", "Triple layered sandwich with chicken, egg and veggies.", 480, None, "Sandwiches", "SND-002", 80, False, True),
    ("Chicken Nuggets (6pc)", "Golden crispy chicken nuggets, six pieces.", 380, None, "Nuggets", "NUG-001", 150, True, True),
    ("Chicken Nuggets (12pc)", "Family pack of twelve crispy chicken nuggets.", 700, 620, "Nuggets", "NUG-002", 90, False, False),
    ("Chicken Wings (6pc)", "Spicy buffalo glazed chicken wings.", 550, None, "Wings", "WNG-001", 100, True, True),
    ("Honey BBQ Wings", "Sweet and smoky BBQ glazed wings.", 600, None, "Wings", "WNG-002", 80, False, False),
    ("Chicken Roll", "Spiced chicken filling wrapped in a soft paratha roll.", 250, None, "Rolls", "ROL-001", 160, False, True),
    ("Seekh Kebab Roll", "Juicy beef seekh kebab wrapped with chutney and onions.", 280, None, "Rolls", "ROL-002", 120, False, False),
    ("Coke (500ml)", "Ice cold Coca-Cola.", 120, None, "Drinks", "DRK-001", 300, False, True),
    ("Pepsi (500ml)", "Ice cold Pepsi.", 120, None, "Drinks", "DRK-002", 300, False, True),
    ("Mango Shake", "Creamy shake made with real mango pulp.", 350, None, "Drinks", "DRK-003", 100, True, False),
    ("Oreo Milkshake", "Thick milkshake blended with Oreo cookies.", 380, None, "Drinks", "DRK-004", 90, False, False),
    ("Chocolate Brownie", "Warm fudgy brownie topped with chocolate drizzle.", 300, None, "Desserts", "DES-001", 80, True, False),
    ("New York Cheesecake", "Rich and creamy classic baked cheesecake slice.", 450, None, "Desserts", "DES-002", 60, False, False),
    ("Family Deal", "2 Burgers, 1 Pizza, 4pc Nuggets, Fries and a 1.5L drink.", 2800, 2400, "Deals", "DEL-001", 40, True, True),
    ("Student Deal", "1 Burger, Fries and a Soft Drink at an unbeatable price.", 550, 450, "Deals", "DEL-002", 100, True, True),
    ("Party Deal", "3 Pizzas, Wings, Loaded Fries and 4 Drinks. Perfect for gatherings.", 4500, 3900, "Deals", "DEL-003", 25, False, False),
]

CATALOG_INITIALIZATION_NAME = "sample_catalog_v1"


class CatalogInitializationConflict(RuntimeError):
    pass


def _inspect_catalog_seed_state(db: Session):
    branches = db.query(Branch).order_by(Branch.id).all()
    expected_branch_names = set(BRANCH_NAMES.values())
    if (
        len(branches) != len(expected_branch_names)
        or {branch.name for branch in branches} != expected_branch_names
        or any(not branch.is_active for branch in branches)
    ):
        raise CatalogInitializationConflict(
            "Expected exactly two active branches: Kallu Chock and Kornagi 2."
        )

    branch_ids = {branch.id for branch in branches}
    branch_by_name = {branch.name: branch for branch in branches}
    branch_names_by_id = {branch.id: branch.name for branch in branches}

    for user in db.query(User).all():
        if user.branch_id is not None and user.branch_id not in branch_ids:
            raise CatalogInitializationConflict(
                "An account references a branch outside the two expected branches."
            )
        if user.role == UserRole.branch_admin and user.branch_id not in branch_ids:
            raise CatalogInitializationConflict(
                "A branch-admin account has no valid branch assignment."
            )

    for order in db.query(Order).all():
        if (
            order.branch_id not in branch_names_by_id
            or order.branch_name != branch_names_by_id[order.branch_id]
        ):
            raise CatalogInitializationConflict(
                "An order has a missing, invalid, or inconsistent branch assignment."
            )

    categories = db.query(Category).all()
    categories_by_id = {category.id: category for category in categories}
    for category in categories:
        if category.branch_id is not None and category.branch_id not in branch_ids:
            raise CatalogInitializationConflict(
                "A category references a branch outside the two expected branches."
            )

    products = db.query(Product).all()
    products_by_sku = {}
    for product in products:
        if product.branch_id not in branch_ids:
            raise CatalogInitializationConflict(
                "A product has no valid branch assignment; no catalog data was changed."
            )
        category = categories_by_id.get(product.category_id)
        if not category or category.branch_id not in (None, product.branch_id):
            raise CatalogInitializationConflict(
                "A product is linked to a missing or differently scoped category."
            )
        products_by_sku[product.sku] = product

    category_by_name = {}
    for name in CATEGORIES:
        slug = slugify(name)
        matches = db.query(Category).filter(
            or_(
                Category.slug == slug,
                func.lower(Category.name) == name.casefold(),
            )
        ).all()
        if len(matches) > 1:
            raise CatalogInitializationConflict(
                f"Multiple existing categories match the seed category '{name}'."
            )
        if matches:
            category = matches[0]
            if (
                category.name != name
                or category.slug != slug
                or category.branch_id is not None
                or not category.is_active
            ):
                raise CatalogInitializationConflict(
                    f"The existing '{name}' category conflicts with the shared catalog."
                )
            category_by_name[name] = category

    expected_product_branches = {}
    for index, product_data in enumerate(PRODUCTS):
        category_name = product_data[4]
        branch_name = BRANCH_NAMES["Branch 1" if index % 2 == 0 else "Branch 2"]
        sku = product_data[5]
        expected_product_branches[sku] = branch_name
        existing = products_by_sku.get(sku)
        if existing:
            if existing.branch_id != branch_by_name[branch_name].id:
                raise CatalogInitializationConflict(
                    f"Seed SKU '{sku}' is assigned to a different branch."
                )
            existing_category = categories_by_id[existing.category_id]
            if existing_category.slug != slugify(category_name):
                raise CatalogInitializationConflict(
                    f"Seed SKU '{sku}' is assigned to a different category."
                )

    return branch_by_name, category_by_name, products_by_sku, expected_product_branches


def initialize_catalog_once(db: Session) -> tuple[int, int] | None:
    """Insert only missing sample catalog rows once, without altering existing rows."""
    try:
        if db.get_bind().dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(741327, 1)"))

        connection = db.connection()
        marker_table_exists = inspect(connection).has_table("foodhub_initializations")
        if marker_table_exists:
            completed = db.execute(
                text(
                    "SELECT 1 FROM foodhub_initializations "
                    "WHERE name = :name"
                ),
                {"name": CATALOG_INITIALIZATION_NAME},
            ).first()
            if completed:
                db.rollback()
                return None

        (
            branch_by_name,
            category_by_name,
            products_by_sku,
            expected_product_branches,
        ) = _inspect_catalog_seed_state(db)

        if not marker_table_exists:
            db.execute(text(
                "CREATE TABLE foodhub_initializations ("
                "name VARCHAR(100) PRIMARY KEY, "
                "completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
            ))

        created_categories = 0
        for name in CATEGORIES:
            if name in category_by_name:
                continue
            category = Category(
                name=name,
                slug=slugify(name),
                is_active=True,
                branch_id=None,
            )
            db.add(category)
            db.flush()
            category_by_name[name] = category
            created_categories += 1

        created_products = 0
        for (
            name,
            description,
            price,
            sale_price,
            category_name,
            sku,
            stock,
            featured,
            popular,
        ) in PRODUCTS:
            if sku in products_by_sku:
                continue
            branch_name = expected_product_branches[sku]
            db.add(Product(
                name=name,
                description=description,
                price=price,
                sale_price=sale_price,
                category_id=category_by_name[category_name].id,
                image=None,
                sku=sku,
                stock=stock,
                featured=featured,
                popular=popular,
                available=True,
                branch_id=branch_by_name[branch_name].id,
            ))
            created_products += 1

        db.flush()
        db.execute(
            text("INSERT INTO foodhub_initializations (name) VALUES (:name)"),
            {"name": CATALOG_INITIALIZATION_NAME},
        )
        db.commit()
        return created_categories, created_products
    except Exception:
        db.rollback()
        raise


def validate_existing_admin_assignments():
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        return
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "branch_id" not in user_columns:
        raise RuntimeError(
            "The existing users table has no branch assignment column. "
            "Review and migrate the existing account assignments before seeding."
        )

    db = SessionLocal()
    try:
        users = db.execute(
            text("SELECT email, role, branch_id FROM users")
        ).mappings().all()
        existing_admins = [
            user for user in users
            if str(user["role"]).casefold() in {"admin", "branch_admin"}
        ]
        if any(admin["branch_id"] is None for admin in existing_admins):
            raise RuntimeError(
                "An existing branch-admin account has no branch assignment. "
                "Verify its identity and branch manually before seeding; it will not be reassigned."
            )

        branch_ids = {}
        if "branches" in tables:
            branches = db.execute(
                text("SELECT id, name FROM branches")
            ).mappings().all()
            for branch_key, display_name in BRANCH_NAMES.items():
                matches = [
                    branch for branch in branches
                    if branch["name"] in {branch_key, display_name}
                ]
                if len(matches) > 1:
                    raise RuntimeError(
                        f"Both {branch_key} and {display_name} exist; "
                        "resolve duplicate branch records before seeding."
                    )
                branch_ids[branch_key] = matches[0]["id"] if matches else None
        else:
            branch_ids = {branch_key: None for branch_key in BRANCH_NAMES}

        target_branch_ids = {value for value in branch_ids.values() if value is not None}
        if existing_admins and (
            len(target_branch_ids) != len(BRANCH_NAMES)
            or any(admin["branch_id"] not in target_branch_ids for admin in existing_admins)
        ):
            raise RuntimeError(
                "Existing branch-admin assignments do not match the configured branches. "
                "Review them manually before seeding; accounts will not be reassigned."
            )

        for branch_key, configured_email in (
            ("Branch 1", settings.BRANCH1_ADMIN_EMAIL),
            ("Branch 2", settings.BRANCH2_ADMIN_EMAIL),
        ):
            branch_id = branch_ids[branch_key]
            if branch_id is not None and any(
                admin["branch_id"] == branch_id for admin in existing_admins
            ):
                continue
            if any(
                str(user["email"]).casefold() == configured_email.casefold()
                for user in users
            ):
                raise RuntimeError(
                    f"The configured {branch_key} admin email already belongs to an account. "
                    "Resolve the account-to-branch mapping manually before seeding."
                )
    finally:
        db.close()


def run():
    required_admin_settings = (
        "BRANCH1_ADMIN_EMAIL",
        "BRANCH1_ADMIN_PASSWORD",
        "BRANCH2_ADMIN_EMAIL",
        "BRANCH2_ADMIN_PASSWORD",
    )
    missing_admin_settings = [
        name for name in required_admin_settings
        if not getattr(settings, name)
    ]
    if missing_admin_settings:
        raise RuntimeError(
            "Set these admin settings in backend/.env before seeding: "
            + ", ".join(missing_admin_settings)
        )
    admin_emails = (
        settings.BRANCH1_ADMIN_EMAIL.strip().casefold(),
        settings.BRANCH2_ADMIN_EMAIL.strip().casefold(),
    )
    if admin_emails[0] == admin_emails[1]:
        raise RuntimeError("Branch 1 and Branch 2 must use different admin email addresses.")

    validate_existing_admin_assignments()
    ensure_branch_schema(backfill_orders=False)
    db = SessionLocal()
    try:
        branches = {}
        for branch_key, display_name in BRANCH_NAMES.items():
            matches = db.query(Branch).filter(
                Branch.name.in_((branch_key, display_name))
            ).all()
            if len(matches) > 1:
                raise RuntimeError(
                    f"Both {branch_key} and {display_name} exist; resolve duplicate branch records before seeding."
                )
            branch = matches[0] if matches else None
            if not branch:
                branch = Branch(name=display_name, is_active=True)
                db.add(branch)
                db.flush()
            else:
                branch.name = display_name
            branches[branch_key] = branch
        db.commit()

        category_map = {}
        for name in CATEGORIES:
            existing = db.query(Category).filter(Category.slug == slugify(name)).first()
            if existing:
                category_map[name] = existing
                continue
            cat = Category(name=name, slug=slugify(name), is_active=True, branch_id=None)
            db.add(cat)
            db.flush()
            category_map[name] = cat
        db.commit()

        for index, (name, desc, price, sale_price, cat_name, sku, stock, featured, popular) in enumerate(PRODUCTS):
            product = db.query(Product).filter(Product.sku == sku).first()
            branch_id = branches["Branch 1" if index % 2 == 0 else "Branch 2"].id
            if product:
                if product.branch_id is None:
                    product.branch_id = branch_id
                elif product.branch_id != branch_id:
                    raise RuntimeError(
                        f"Seed product '{sku}' is already assigned to branch "
                        f"{product.branch_id}, not branch {branch_id}; it was not reassigned."
                    )
                continue
            product = Product(
                name=name,
                description=desc,
                price=price,
                sale_price=sale_price,
                category_id=category_map[cat_name].id,
                image=None,
                sku=sku,
                stock=stock,
                featured=featured,
                popular=popular,
                available=True,
                branch_id=branch_id,
            )
            db.add(product)
        db.commit()

        ensure_branch_schema()

        for name, email, password, branch_name in (
            ("Branch 1 Admin", settings.BRANCH1_ADMIN_EMAIL, settings.BRANCH1_ADMIN_PASSWORD, "Branch 1"),
            ("Branch 2 Admin", settings.BRANCH2_ADMIN_EMAIL, settings.BRANCH2_ADMIN_PASSWORD, "Branch 2"),
        ):
            existing_branch_admin = db.query(User).filter(
                User.role == UserRole.branch_admin,
                User.branch_id == branches[branch_name].id,
            ).first()
            if existing_branch_admin:
                continue

            existing_email = db.query(User).filter(User.email == email).first()
            if existing_email:
                raise RuntimeError(
                    f"The configured {branch_name} admin email already belongs to an account. "
                    "Resolve the account-to-branch mapping manually; seeding will not reassign or update it."
                )

            db.add(User(
                full_name=name,
                email=email,
                phone="03000000000",
                hashed_password=hash_password(password),
                role=UserRole.branch_admin,
                branch_id=branches[branch_name].id,
                is_active=True,
            ))
        db.commit()

        print(f"Seeded {len(CATEGORIES)} categories and {len(PRODUCTS)} products.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
