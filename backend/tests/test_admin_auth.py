import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.database import Base
from app.models.branch import Branch
from app.models.user import User, UserRole
from app.dependencies.auth import get_current_active_admin
from app.routers.auth import login
from app.schemas.user import UserLogin
from app.utils.security import hash_password


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


@pytest.mark.parametrize(
    ("email", "password", "branch_name"),
    [
        ("branch-one-admin@example.com", "branch-one-test-password", "Kallu Chock"),
        ("branch-two-admin@example.com", "branch-two-test-password", "Kornagi 2"),
    ],
)
def test_branch_admin_login_returns_the_assigned_branch(
    db_session, email, password, branch_name
):
    branch = Branch(name=branch_name, is_active=True)
    db_session.add(branch)
    db_session.flush()
    db_session.add(User(
        full_name=f"{branch_name} Admin",
        email=email,
        phone="03000000000",
        hashed_password=hash_password(password),
        role=UserRole.branch_admin,
        branch_id=branch.id,
        is_active=True,
    ))
    db_session.commit()

    result = login(UserLogin(email=email, password=password), db_session)

    assert result.user.role == UserRole.branch_admin
    assert result.user.branch_id == branch.id


def test_branch_admin_login_rejects_an_incorrect_password(db_session):
    branch = Branch(name="Kallu Chock", is_active=True)
    db_session.add(branch)
    db_session.flush()
    db_session.add(User(
        full_name="Test Branch Admin",
        email="branch-admin@example.com",
        phone="03000000000",
        hashed_password=hash_password("correct-test-password"),
        role=UserRole.branch_admin,
        branch_id=branch.id,
        is_active=True,
    ))
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        login(
            UserLogin(
                email="branch-admin@example.com",
                password="incorrect-test-password",
            ),
            db_session,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid email or password"


def test_branch_admin_login_rejects_a_missing_email(db_session):
    with pytest.raises(HTTPException) as exc_info:
        login(
            UserLogin(
                email="missing-admin@example.com",
                password="test-only-password",
            ),
            db_session,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid email or password"


def test_branch_admin_login_rejects_a_disabled_account(db_session):
    branch = Branch(name="Kallu Chock", is_active=True)
    db_session.add(branch)
    db_session.flush()
    db_session.add(User(
        full_name="Disabled Test Admin",
        email="disabled-admin@example.com",
        phone="03000000000",
        hashed_password=hash_password("test-only-password"),
        role=UserRole.branch_admin,
        branch_id=branch.id,
        is_active=False,
    ))
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        login(
            UserLogin(
                email="disabled-admin@example.com",
                password="test-only-password",
            ),
            db_session,
        )

    assert exc_info.value.status_code == 403


def test_customer_cannot_access_branch_admin_dependencies(db_session):
    customer = User(
        full_name="Test Customer",
        email="test-customer@example.com",
        phone="03000000000",
        hashed_password=hash_password("test-only-password"),
        role=UserRole.customer,
        branch_id=None,
        is_active=True,
    )

    with pytest.raises(HTTPException) as exc_info:
        get_current_active_admin(customer)

    assert exc_info.value.status_code == 403
