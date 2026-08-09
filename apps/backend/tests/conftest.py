import uuid

import pytest_asyncio
from fastapi import Header
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.audit_log import AuditLog
from app.models.design_request import DesignRequest
from app.models.membership import Cohort
from app.models.user import AllowedEmail, User, UserRole, UserSession
from app.modules.ops.deps import get_current_user

_TEST_TABLES = [
    User.__table__,
    UserSession.__table__,
    AllowedEmail.__table__,
    Cohort.__table__,
    DesignRequest.__table__,
    AuditLog.__table__,
]


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda c: Base.metadata.create_all(c, tables=_TEST_TABLES)
        )

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda c: Base.metadata.drop_all(c, tables=_TEST_TABLES)
        )
    await engine.dispose()


def _make_eboard_user() -> User:
    # Explicit id: these users are never added/flushed to db_session (tests
    # only need dependency-override objects, not persisted rows), so the
    # column's default=uuid.uuid4 — a flush-time default — would otherwise
    # never fire, leaving .id as None and making any current_user.id
    # comparison in application code silently match every other null id.
    return User(
        id=uuid.uuid4(),
        email="eboard@cornell.edu",
        name="Eboard User",
        google_sub="eboard_google_sub",
        role=UserRole.eboard,
        is_active=True,
    )


def _make_member_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="member@cornell.edu",
        name="Regular Member",
        google_sub="member_google_sub",
        role=UserRole.member,
        is_active=True,
    )


@pytest_asyncio.fixture
async def _role_clients(db_session: AsyncSession):
    """Sets up both an eboard- and a member-identity client sharing one
    db_session. app.dependency_overrides is a single global dict on the app
    object — it is NOT per-AsyncClient — so a test using eboard_client and
    member_client together must dispatch identity from something carried on
    each request (a header) rather than from two separate closures that
    would just overwrite each other's override.
    """
    eboard = _make_eboard_user()
    member = _make_member_user()
    users_by_header = {"eboard": eboard, "member": member}

    async def override_db():
        yield db_session

    async def override_user(x_test_user: str = Header(default="member")):
        return users_by_header[x_test_user]

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user

    transport = ASGITransport(app=app)
    async with (
        AsyncClient(transport=transport, base_url="http://test", headers={"X-Test-User": "eboard"}) as eboard_ac,
        AsyncClient(transport=transport, base_url="http://test", headers={"X-Test-User": "member"}) as member_ac,
    ):
        yield eboard_ac, member_ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def eboard_client(_role_clients):
    eboard_ac, _ = _role_clients
    yield eboard_ac


@pytest_asyncio.fixture
async def member_client(_role_clients):
    _, member_ac = _role_clients
    yield member_ac
