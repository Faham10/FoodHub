import re

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker, declarative_base, joinedload

from app.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_branch_schema(backfill_orders=True):
    """Create branch schema and migrate legacy orders to branch-scoped numbers."""
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    columns_by_table = {
        "branches": (
            "delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE",
            "delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 150",
            "free_delivery_threshold NUMERIC(10, 2) DEFAULT 3000",
            "minimum_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0",
            "delivery_areas TEXT NOT NULL DEFAULT ''",
        ),
        "users": "branch_id INTEGER",
        "categories": "branch_id INTEGER",
        "products": "branch_id INTEGER",
        "carts": "branch_id INTEGER",
        "orders": "branch_id INTEGER REFERENCES branches(id)",
        "promotions": "system_key VARCHAR(50)",
    }
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'branch_admin'"))

    with engine.begin() as connection:
        for table, definition in columns_by_table.items():
            if table not in inspector.get_table_names():
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table)}
            definitions = definition if isinstance(definition, tuple) else (definition,)
            for column_definition in definitions:
                column_name = column_definition.split()[0]
                if column_name not in existing_columns:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_definition}"))
        if "orders" in inspector.get_table_names():
            order_columns = {column["name"] for column in inspector.get_columns("orders")}
            order_column_definitions = {
                "order_number": "VARCHAR(32)",
                "branch_name": "VARCHAR(80)",
                "order_type": "VARCHAR(20) DEFAULT 'Delivery'",
                "tracking_token": "VARCHAR(64)",
                "table_info": "VARCHAR(120)",
                "delivery_area": "VARCHAR(120)",
                "instructions": "TEXT",
                "promotion_name": "VARCHAR(160)",
                "coupon_code": "VARCHAR(40)",
            }
            for column, definition in order_column_definitions.items():
                if column not in order_columns:
                    connection.execute(text(f"ALTER TABLE orders ADD COLUMN {column} {definition}"))
        if "users" in inspector.get_table_names():
            connection.execute(text(
                "UPDATE users SET role = 'branch_admin' "
                "WHERE CAST(role AS VARCHAR) = 'admin'"
            ))
        if "promotions" in inspector.get_table_names():
            connection.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_promotions_branch_system_key "
                "ON promotions (branch_id, system_key)"
            ))

    rename_legacy_branches()

    if backfill_orders:
        migrate_order_branch_data()
    with SessionLocal() as db:
        ensure_legacy_discount_promotions(db)


def ensure_legacy_discount_promotions(db):
    from app.models.branch import Branch
    from app.models.promotion import Promotion

    for branch in db.query(Branch).filter(Branch.is_active.is_(True)).all():
        existing = db.query(Promotion.id).filter(
            Promotion.branch_id == branch.id,
            Promotion.system_key == "legacy-cart-discount",
        ).first()
        if not existing:
            db.add(Promotion(
                branch_id=branch.id,
                name="Classic order discount",
                description="The existing 100 PKR discount on orders of 2,000 PKR or more.",
                discount_type="fixed",
                discount_value=100,
                minimum_order_amount=2000,
                system_key="legacy-cart-discount",
                is_active=True,
            ))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        missing = (
            db.query(Branch.id)
            .outerjoin(
                Promotion,
                (Promotion.branch_id == Branch.id)
                & (Promotion.system_key == "legacy-cart-discount"),
            )
            .filter(Branch.is_active.is_(True), Promotion.id.is_(None))
            .first()
        )
        if missing:
            raise


def rename_legacy_branches():
    from app.models.branch import Branch
    from app.models.order import Order

    branch_names = {
        "Branch 1": "Kallu Chock",
        "Branch 2": "Kornagi 2",
    }
    with SessionLocal() as db:
        for old_name, new_name in branch_names.items():
            branch = db.query(Branch).filter(Branch.name == old_name).first()
            if not branch:
                continue
            duplicate = db.query(Branch).filter(
                Branch.name == new_name,
                Branch.id != branch.id,
            ).first()
            if duplicate:
                raise RuntimeError(
                    f"Cannot rename {old_name}: another branch already uses {new_name}."
                )
            branch.name = new_name
            db.query(Order).filter(
                Order.branch_id == branch.id,
                Order.branch_name == old_name,
            ).update({Order.branch_name: new_name}, synchronize_session=False)
        db.commit()


def migrate_order_branch_data():
    from app.models.branch import Branch
    from app.models.order import BranchOrderSequence, Order, OrderItem

    with SessionLocal() as db:
        if engine.dialect.name == "postgresql":
            db.execute(text("LOCK TABLE orders IN ACCESS EXCLUSIVE MODE"))

        branches = db.query(Branch).order_by(Branch.id).all()
        if not branches:
            if db.query(Order.id).first():
                raise RuntimeError("Cannot assign legacy orders to branches: run the database seed to create both active branches.")
            return

        default_branch = branches[0]
        orders = (
            db.query(Order)
            .options(joinedload(Order.items).joinedload(OrderItem.product))
            .order_by(Order.id)
            .all()
        )
        # Load the products for legacy orders when their original branch can be inferred.
        for order in orders:
            if not order.order_type:
                order.order_type = "Delivery"
            if order.branch_id is not None:
                if not order.branch_name:
                    branch = next((branch for branch in branches if branch.id == order.branch_id), None)
                    order.branch_name = branch.name if branch else default_branch.name
                continue
            item_branch_ids = {
                item.product.branch_id
                for item in order.items
                if item.product is not None and item.product.branch_id is not None
            }
            order.branch_id = item_branch_ids.pop() if len(item_branch_ids) == 1 else default_branch.id
            order.branch_name = next(
                branch.name for branch in branches if branch.id == order.branch_id
            )

        sequences = {
            sequence.branch_id: sequence
            for sequence in db.query(BranchOrderSequence).all()
        }
        used_numbers = {branch.id: set() for branch in branches}
        high_water_marks = {
            branch.id: sequences.get(branch.id).last_number if branch.id in sequences else 0
            for branch in branches
        }
        number_pattern = re.compile(r"^B(\d+)-(\d+)$")

        for order in orders:
            match = number_pattern.fullmatch(order.order_number or "")
            if match and int(match.group(1)) == order.branch_id:
                number = int(match.group(2))
                if number not in used_numbers[order.branch_id]:
                    used_numbers[order.branch_id].add(number)
                    high_water_marks[order.branch_id] = max(high_water_marks[order.branch_id], number)
                    continue
            order.order_number = None

        for order in orders:
            if order.order_number is not None:
                continue
            next_number = high_water_marks[order.branch_id] + 1
            while next_number in used_numbers[order.branch_id]:
                next_number += 1
            order.order_number = f"B{order.branch_id}-{next_number:04d}"
            used_numbers[order.branch_id].add(next_number)
            high_water_marks[order.branch_id] = next_number

        for branch in branches:
            sequence = sequences.get(branch.id)
            if sequence is None:
                sequence = BranchOrderSequence(branch_id=branch.id, last_number=0)
                db.add(sequence)
            sequence.last_number = max(sequence.last_number, high_water_marks[branch.id])

        db.commit()

    with engine.begin() as connection:
        if engine.dialect.name == "postgresql":
            order_foreign_keys = inspect(connection).get_foreign_keys("orders")
            if not any(
                foreign_key["constrained_columns"] == ["branch_id"]
                and foreign_key["referred_table"] == "branches"
                for foreign_key in order_foreign_keys
            ):
                connection.execute(text(
                    "ALTER TABLE orders ADD CONSTRAINT orders_branch_id_fkey "
                    "FOREIGN KEY (branch_id) REFERENCES branches(id)"
                ))
            connection.execute(text("ALTER TABLE orders ALTER COLUMN branch_id SET NOT NULL"))
            connection.execute(text("ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL"))
            connection.execute(text("ALTER TABLE orders ALTER COLUMN branch_name SET NOT NULL"))
            connection.execute(text("ALTER TABLE orders ALTER COLUMN order_type SET NOT NULL"))
            connection.execute(text("ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL"))
        elif engine.dialect.name == "sqlite":
            connection.execute(text(
                "CREATE TRIGGER IF NOT EXISTS orders_require_branch_number_and_type_insert "
                "BEFORE INSERT ON orders "
                "WHEN NEW.branch_id IS NULL OR NEW.order_number IS NULL "
                "OR NEW.branch_name IS NULL OR NEW.order_type IS NULL "
                "BEGIN SELECT RAISE(ABORT, 'orders branch and order details are required'); END"
            ))
            connection.execute(text(
                "CREATE TRIGGER IF NOT EXISTS orders_require_branch_number_and_type_update "
                "BEFORE UPDATE OF branch_id, order_number, branch_name, order_type ON orders "
                "WHEN NEW.branch_id IS NULL OR NEW.order_number IS NULL "
                "OR NEW.branch_name IS NULL OR NEW.order_type IS NULL "
                "BEGIN SELECT RAISE(ABORT, 'orders branch and order details are required'); END"
            ))
        else:
            raise RuntimeError(
                f"Order schema migration is not implemented for database dialect '{engine.dialect.name}'"
            )
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_branch_order_number "
            "ON orders (branch_id, order_number)"
        ))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_tracking_token "
            "ON orders (tracking_token)"
        ))
