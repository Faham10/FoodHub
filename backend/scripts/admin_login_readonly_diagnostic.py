"""Read-only comparison of configured branch-admin credentials and database rows."""

import os
import sys
import getpass
from pathlib import Path

from passlib.exc import UnknownHashError

if os.environ.get("FOODHUB_READONLY_DIAGNOSTIC") != "YES":
    print("Set FOODHUB_READONLY_DIAGNOSTIC=YES in PowerShell to enable this check.")
    raise SystemExit(2)

# Prevent application settings from loading backend/.env in this process.
os.environ["FOODHUB_DISABLE_DOTENV"] = "1"
# Token signing is unused by this diagnostic; avoid requiring the real key.
os.environ["SECRET_KEY"] = "readonly-diagnostic-unused"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

SETTING_NAMES = (
    "DATABASE_URL",
    "BRANCH1_ADMIN_EMAIL",
    "BRANCH1_ADMIN_PASSWORD",
    "BRANCH2_ADMIN_EMAIL",
    "BRANCH2_ADMIN_PASSWORD",
)

BRANCHES = (
    ("Kallu Chock", "BRANCH1_ADMIN_EMAIL", "BRANCH1_ADMIN_PASSWORD"),
    ("Kornagi 2", "BRANCH2_ADMIN_EMAIL", "BRANCH2_ADMIN_PASSWORD"),
)


def yes_no_unknown(value: bool | None) -> str:
    if value is None:
        return "UNKNOWN"
    return "YES" if value else "NO"


def main() -> int:
    try:
        if not sys.stdin.isatty() or not sys.stdout.isatty():
            print("Diagnostic requires an interactive PowerShell terminal.")
            return 2

        confirmation = input(
            "Type READ-ONLY NON-OWNER to confirm this is a dedicated "
            "read-only Neon role (not the owner): "
        )
        if confirmation != "READ-ONLY NON-OWNER":
            print("Diagnostic cancelled; no database connection was opened.")
            return 2

        prompts = (
            ("DATABASE_URL", "Read-only Neon PostgreSQL connection string"),
            ("BRANCH1_ADMIN_EMAIL", "Branch 1 configured admin email"),
            ("BRANCH1_ADMIN_PASSWORD", "Branch 1 configured admin password"),
            ("BRANCH2_ADMIN_EMAIL", "Branch 2 configured admin email"),
            ("BRANCH2_ADMIN_PASSWORD", "Branch 2 configured admin password"),
        )
        for name, prompt in prompts:
            os.environ[name] = getpass.getpass(f"{prompt} (input hidden): ")

        missing_settings = [
            name for name in SETTING_NAMES
            if not os.environ.get(name)
        ]
        if missing_settings:
            print("Diagnostic cancelled; one or more required inputs were empty.")
            return 2

        from sqlalchemy.orm import Session

        from app.config import settings
        from app.database import engine
        from app.models.branch import Branch
        from app.models.user import User, UserRole
        from app.utils.security import verify_password

        if engine.dialect.name != "postgresql":
            print("Diagnostic stopped: a PostgreSQL database connection is required.")
            return 2

        with engine.connect() as connection:
            connection.exec_driver_sql("SET TRANSACTION READ ONLY")
            with Session(
                bind=connection,
                autoflush=False,
                expire_on_commit=False,
            ) as db:
                for branch_name, email_setting, password_setting in BRANCHES:
                    branch_ids = db.query(Branch.id).filter(
                        Branch.name == branch_name
                    ).all()
                    if len(branch_ids) != 1:
                        exists = None
                        email_matches = active = password_verifies = None
                    else:
                        admin_rows = db.query(
                            User.email,
                            User.is_active,
                            User.hashed_password,
                        ).filter(
                            User.branch_id == branch_ids[0][0],
                            User.role == UserRole.branch_admin,
                        ).all()
                        exists = bool(admin_rows)
                        if len(admin_rows) != 1:
                            email_matches = active = password_verifies = None
                        else:
                            row = admin_rows[0]
                            configured_email = getattr(settings, email_setting)
                            configured_password = getattr(settings, password_setting)
                            email_matches = (
                                row.email == configured_email
                                if configured_email
                                else None
                            )
                            active = bool(row.is_active)
                            if not configured_password:
                                password_verifies = None
                            else:
                                try:
                                    password_verifies = verify_password(
                                        configured_password,
                                        row.hashed_password,
                                    )
                                except (TypeError, ValueError, UnknownHashError):
                                    password_verifies = False

                    print(
                        f"{branch_name}: "
                        f"account exists={yes_no_unknown(exists)}; "
                        f"configured email matches={yes_no_unknown(email_matches)}; "
                        f"active={yes_no_unknown(active)}; "
                        f"configured password verifies={yes_no_unknown(password_verifies)}"
                    )
        return 0
    except Exception:
        # Deliberately omit exception details, which may contain connection data.
        print("Diagnostic stopped: read-only database access failed.")
        return 1
    finally:
        for name in SETTING_NAMES:
            os.environ.pop(name, None)
        os.environ.pop("SECRET_KEY", None)
        os.environ.pop("FOODHUB_DISABLE_DOTENV", None)


if __name__ == "__main__":
    raise SystemExit(main())
