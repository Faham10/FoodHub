"""One-time, explicitly approved recovery for two missing branch-admin rows."""

import getpass
import os
import re
import sys
from pathlib import Path

SETTING_NAMES = (
    "DATABASE_URL",
    "BRANCH1_ADMIN_EMAIL",
    "BRANCH1_ADMIN_PASSWORD",
    "BRANCH2_ADMIN_EMAIL",
    "BRANCH2_ADMIN_PASSWORD",
)
SCRIPT_ENV_NAMES = (*SETTING_NAMES, "SECRET_KEY", "FOODHUB_DISABLE_DOTENV")
ORIGINAL_ENV = {name: os.environ.get(name) for name in SCRIPT_ENV_NAMES}

BRANCHES = (
    ("Kallu Chock", "BRANCH1_ADMIN_EMAIL", "BRANCH1_ADMIN_PASSWORD", "Branch 1 Admin"),
    ("Kornagi 2", "BRANCH2_ADMIN_EMAIL", "BRANCH2_ADMIN_PASSWORD", "Branch 2 Admin"),
)


class RecoveryAbort(Exception):
    """A preflight check failed; no account changes are allowed."""


def collect_inputs() -> None:
    prompts = (
        ("DATABASE_URL", "Authorized PostgreSQL connection string"),
        ("BRANCH1_ADMIN_EMAIL", "Branch 1 admin email"),
        ("BRANCH1_ADMIN_PASSWORD", "Branch 1 admin password"),
        ("BRANCH2_ADMIN_EMAIL", "Branch 2 admin email"),
        ("BRANCH2_ADMIN_PASSWORD", "Branch 2 admin password"),
    )
    for name, prompt in prompts:
        os.environ[name] = getpass.getpass(f"{prompt} (input hidden): ")

    if any(not os.environ.get(name) for name in SETTING_NAMES):
        raise RecoveryAbort("Recovery cancelled; one or more required inputs were empty.")


def classify_existing_users(users, branches_by_name, emails, passwords, UserRole, verify):
    if not users:
        return "insert"

    users_by_email = {user.email.casefold(): user for user in users}
    if len(users) != 2 or len(users_by_email) != 2:
        raise RecoveryAbort(
            "User preflight failed: existing users conflict with the two target accounts."
        )

    for (branch_name, _, password_setting, _), email in zip(BRANCHES, emails):
        user = users_by_email.get(email.casefold())
        if (
            user is None
            or user.role != UserRole.branch_admin
            or user.branch_id != branches_by_name[branch_name].id
            or not user.is_active
            or not verify(passwords[password_setting], user.hashed_password)
        ):
            raise RecoveryAbort(
                "User preflight failed: existing account state conflicts with the approved targets."
            )

    return "already_complete"


def preflight(db, Branch, User, UserRole, verify):
    from sqlalchemy import func, text

    privilege = db.execute(text(
        """
        SELECT
            current_schema() = 'public' AS uses_public_schema,
            r.rolsuper AS is_superuser,
            r.rolcreaterole AS can_create_roles,
            d.datdba = r.oid AS is_database_owner,
            u.relowner = r.oid AS is_users_table_owner,
            pg_has_role(r.oid, d.datdba, 'MEMBER')
                AS member_of_database_owner,
            pg_has_role(r.oid, u.relowner, 'MEMBER')
                AS member_of_users_table_owner,
            has_table_privilege(r.oid, u.oid, 'SELECT')
                AS can_read_users,
            has_table_privilege(r.oid, u.oid, 'INSERT')
                AS can_insert_users,
            has_sequence_privilege(
                r.oid, pg_get_serial_sequence('users', 'id'), 'USAGE'
            ) AS can_use_user_id_sequence,
            has_table_privilege(r.oid, b.oid, 'SELECT')
                AS can_read_branches,
            has_schema_privilege(r.oid, n.oid, 'USAGE')
                AS can_use_public_schema,
            has_type_privilege(r.oid, attribute.atttypid, 'USAGE')
                AS can_use_role_enum,
            u.oid = to_regclass('public.users')
                AND b.oid = to_regclass('public.branches')
                AS public_tables_resolved
        FROM pg_roles AS r
        JOIN pg_database AS d
            ON d.datname = current_database()
        JOIN pg_class AS u
            ON u.oid = to_regclass('public.users')
        JOIN pg_class AS b
            ON b.oid = to_regclass('public.branches')
        JOIN pg_namespace AS n
            ON n.nspname = 'public'
        JOIN pg_attribute AS attribute
            ON attribute.attrelid = u.oid
            AND attribute.attname = 'role'
            AND NOT attribute.attisdropped
        WHERE r.rolname = current_user
        """
    )).one_or_none()
    if privilege is None:
        raise RecoveryAbort("Role preflight failed: database role could not be verified.")
    if any(privilege[1:7]):
        raise RecoveryAbort(
            "Role preflight failed: use a dedicated non-owner, non-superuser write role."
        )
    if not all(privilege[0:1] + privilege[7:]):
        raise RecoveryAbort(
            "Role preflight failed: wrong schema/table or missing table, sequence, "
            "schema, or enum permissions."
        )

    role_labels = {
        row[0]
        for row in db.execute(text(
            """
            SELECT enum.enumlabel
            FROM pg_attribute AS attribute
            JOIN pg_class AS table_info
                ON table_info.oid = attribute.attrelid
            JOIN pg_enum AS enum
                ON enum.enumtypid = attribute.atttypid
            WHERE table_info.oid = to_regclass('public.users')
                AND attribute.attname = 'role'
                AND NOT attribute.attisdropped
            """
        )).all()
    }
    if not {"customer", "branch_admin"}.issubset(role_labels):
        raise RecoveryAbort(
            "Role preflight failed: PostgreSQL users.role enum lacks required labels."
        )

    branch_rows = db.query(Branch.id, Branch.name, Branch.is_active).all()
    expected_names = {branch_name for branch_name, *_ in BRANCHES}
    if len(branch_rows) != len(expected_names):
        raise RecoveryAbort(
            "Branch preflight failed: expected exactly the two approved branch rows."
        )
    if {row.name for row in branch_rows} != expected_names:
        raise RecoveryAbort(
            "Branch preflight failed: names differ from the approved exact branch names."
        )
    if any(not row.is_active for row in branch_rows):
        raise RecoveryAbort("Branch preflight failed: a target branch is inactive.")

    branches_by_name = {row.name: row for row in branch_rows}
    if len({row.id for row in branch_rows}) != 2:
        raise RecoveryAbort("Branch preflight failed: branch IDs are ambiguous.")

    emails = [
        os.environ[email_setting].strip()
        for _, email_setting, _, _ in BRANCHES
    ]
    if any(
        not email or "@" not in email or any(char.isspace() for char in email)
        for email in emails
    ):
        raise RecoveryAbort("Credential preflight failed: an admin email is invalid.")
    if len({email.casefold() for email in emails}) != 2:
        raise RecoveryAbort("Credential preflight failed: admin emails must be distinct.")
    if any(len(email) > 120 for email in emails):
        raise RecoveryAbort("Credential preflight failed: an admin email is too long.")

    passwords = {
        password_setting: os.environ[password_setting]
        for _, _, password_setting, _ in BRANCHES
    }
    if any(not password for password in passwords.values()):
        raise RecoveryAbort("Credential preflight failed: an admin password is empty.")

    existing_users = db.query(User).filter(
        (func.lower(User.email).in_([email.casefold() for email in emails]))
        | (User.role == UserRole.branch_admin)
    ).all()
    state = classify_existing_users(
        existing_users, branches_by_name, emails, passwords, UserRole, verify
    )
    return branches_by_name, emails, passwords, state


def main() -> int:
    engine = None
    stage = "startup"
    try:
        if os.environ.get("FOODHUB_ADMIN_RECOVERY") != "YES":
            print("Set FOODHUB_ADMIN_RECOVERY=YES in PowerShell to enable this recovery.")
            return 2
        if not sys.stdin.isatty() or not sys.stdout.isatty():
            print("Recovery requires an interactive PowerShell terminal.")
            return 2

        # Never load local dotenv values or require the real JWT signing key.
        os.environ["FOODHUB_DISABLE_DOTENV"] = "1"
        os.environ["SECRET_KEY"] = "recovery-script-unused"
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

        collect_inputs()
        stage = "loading application models"

        from sqlalchemy import text
        from sqlalchemy.orm import Session

        from app.database import engine as app_engine
        from app.models.branch import Branch
        from app.models.user import User, UserRole
        from app.utils.security import hash_password, verify_password

        engine = app_engine
        if engine.dialect.name != "postgresql":
            raise RecoveryAbort("Recovery stopped: PostgreSQL is required.")

        # First preflight is strictly read-only and establishes the target.
        stage = "read-only preflight (schema, enum and role permissions)"
        with engine.connect() as connection:
            connection.exec_driver_sql("SET TRANSACTION READ ONLY")
            with Session(bind=connection, autoflush=False) as db:
                branches_by_name, emails, _, state = preflight(
                    db, Branch, User, UserRole, verify_password
                )
                print("Read-only preflight passed for the two intended branch rows.")
                for (branch_name, _, _, _), email in zip(BRANCHES, emails):
                    print(
                        f"Target: {branch_name}; "
                        f"branch ID resolved; email configured; account "
                        f"{'already complete' if state == 'already_complete' else 'will be inserted'}."
                    )
            connection.rollback()

        if state == "already_complete":
            print("Recovery is already complete; no account rows were changed.")
            return 0

        final_confirmation = input(
            "To authorize the two-user insert in this database, type "
            "INSERT TWO BRANCH ADMINS: "
        )
        if final_confirmation != "INSERT TWO BRANCH ADMINS":
            raise RecoveryAbort("Recovery cancelled; no account rows were inserted.")

        # Serialize recovery-script runs; ordinary inserts retain only their
        # normal table lock requirements.
        stage = "transactional preflight and insertion"
        with Session(bind=engine, autoflush=False, expire_on_commit=False) as db:
            with db.begin():
                db.execute(text("SELECT pg_advisory_xact_lock(741328, 2)"))
                branches_by_name, emails, passwords, state = preflight(
                    db, Branch, User, UserRole, verify_password
                )
                if state == "already_complete":
                    print("Recovery is already complete; no account rows were changed.")
                    return 0
                users_to_add = []
                for (branch_name, _, password_setting, full_name), email in zip(
                    BRANCHES, emails
                ):
                    users_to_add.append(User(
                        full_name=full_name,
                        email=email,
                        phone="03000000000",
                        hashed_password=hash_password(passwords[password_setting]),
                        role=UserRole.branch_admin,
                        branch_id=branches_by_name[branch_name].id,
                        is_active=True,
                    ))
                db.add_all(users_to_add)
                db.flush()
            print("Recovery completed: two branch-admin accounts inserted.")
        return 0
    except RecoveryAbort as exc:
        print(str(exc))
        return 2
    except Exception as exc:
        print(f"Recovery stopped at {stage}: {safe_error_summary(exc)}.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()
        for name in SETTING_NAMES:
            if ORIGINAL_ENV[name] is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = ORIGINAL_ENV[name]
        for name in ("SECRET_KEY", "FOODHUB_DISABLE_DOTENV"):
            if ORIGINAL_ENV[name] is None:
                os.environ.pop(name, None)
            else:
                os.environ[name] = ORIGINAL_ENV[name]


def safe_error_summary(exc: Exception) -> str:
    """Describe failure class and SQLSTATE without exposing driver messages."""
    error_type = type(exc).__name__
    original = getattr(exc, "orig", None)
    sqlstate = getattr(original, "sqlstate", None) or getattr(original, "pgcode", None)
    if isinstance(sqlstate, str) and re.fullmatch(r"[A-Z0-9]{5}", sqlstate):
        return f"{error_type} (PostgreSQL SQLSTATE {sqlstate})"
    return error_type


if __name__ == "__main__":
    raise SystemExit(main())
