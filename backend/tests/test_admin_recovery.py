from types import SimpleNamespace

import pytest

from app.models.user import UserRole
from scripts.recover_missing_branch_admins_once import (
    RecoveryAbort,
    classify_existing_users,
    safe_error_summary,
    validate_database_role,
)


def target_branches():
    return {
        "Kallu Chock": SimpleNamespace(id=1),
        "Kornagi 2": SimpleNamespace(id=2),
    }


def target_emails():
    return ["branch-one@example.test", "branch-two@example.test"]


def target_passwords():
    return {
        "BRANCH1_ADMIN_PASSWORD": "test-password-one",
        "BRANCH2_ADMIN_PASSWORD": "test-password-two",
    }


def users_for_targets():
    return [
        SimpleNamespace(
            email=email,
            role=UserRole.branch_admin,
            branch_id=index,
            is_active=True,
            hashed_password=f"hash-{index}",
        )
        for index, email in enumerate(target_emails(), start=1)
    ]


def password_matches(password, password_hash):
    return password_hash == f"hash-{1 if password.endswith('one') else 2}"


def classify(users, verify=password_matches):
    return classify_existing_users(
        users,
        target_branches(),
        target_emails(),
        target_passwords(),
        UserRole,
        verify,
    )


def test_admin_recovery_plans_insert_when_no_target_accounts_exist():
    assert classify([]) == "insert"


def test_admin_recovery_is_idempotent_for_both_matching_accounts():
    assert classify(users_for_targets()) == "already_complete"


def change_email(users):
    users[0].email = "conflicting@example.test"


@pytest.mark.parametrize(
    "mutate",
    [
        lambda users: users.pop(),
        change_email,
        lambda users: setattr(users[0], "role", UserRole.customer),
        lambda users: setattr(users[0], "branch_id", 2),
        lambda users: setattr(users[0], "is_active", False),
    ],
)
def test_admin_recovery_aborts_on_partial_or_conflicting_accounts(mutate):
    users = users_for_targets()
    mutate(users)

    with pytest.raises(RecoveryAbort):
        classify(users)


def test_admin_recovery_aborts_when_configured_password_does_not_match():
    with pytest.raises(RecoveryAbort):
        classify(users_for_targets(), verify=lambda _password, _hash: False)


def test_recovery_error_summary_excludes_database_error_details():
    class DriverError(Exception):
        sqlstate = "42501"

    class DatabaseError(Exception):
        def __init__(self):
            super().__init__("sensitive connection detail")
            self.orig = DriverError("password or connection string")

    summary = safe_error_summary(DatabaseError())

    assert summary == "DatabaseError (PostgreSQL SQLSTATE 42501)"
    assert "sensitive" not in summary
    assert "password" not in summary


def valid_database_role_privileges():
    return {
        "is_superuser": False,
        "can_create_roles": False,
        "is_database_owner": False,
        "is_users_table_owner": False,
        "member_of_database_owner": False,
        "member_of_users_table_owner": False,
        "uses_public_schema": True,
        "can_read_users": True,
        "can_insert_users": True,
        "can_use_user_id_sequence": True,
        "can_read_branches": True,
        "can_use_public_schema": True,
        "can_use_role_enum": True,
        "public_tables_resolved": True,
    }


def test_database_role_requires_insert_and_role_enum_usage():
    privileges = valid_database_role_privileges()
    privileges["can_insert_users"] = False
    privileges["can_use_role_enum"] = False

    with pytest.raises(RecoveryAbort) as exc_info:
        validate_database_role(privileges)

    message = str(exc_info.value)
    assert "INSERT on public.users" in message
    assert "USAGE on the public.users role enum" in message
    assert "password" not in message


def test_database_role_rejects_owner_or_elevated_role():
    privileges = valid_database_role_privileges()
    privileges["is_users_table_owner"] = True

    with pytest.raises(RecoveryAbort, match="non-owner"):
        validate_database_role(privileges)
