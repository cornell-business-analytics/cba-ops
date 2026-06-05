import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.membership import Cohort
from app.models.user import AllowedEmail, User, UserRole, UserSession
from app.modules.ops.deps import get_current_user

_TEST_TABLES = [
    User.__table__,
    UserSession.__table__,
    AllowedEmail.__table__,
    Cohort.__table__,
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
    return User(
        email="eboard@cornell.edu",
        name="Eboard User",
        google_sub="eboard_google_sub",
        role=UserRole.eboard,
        is_active=True,
    )


def _make_member_user() -> User:
    return User(
        email="member@cornell.edu",
        name="Regular Member",
        google_sub="member_google_sub",
        role=UserRole.member,
        is_active=True,
    )


@pytest_asyncio.fixture
async def eboard_client(db_session: AsyncSession):
    eboard = _make_eboard_user()

    async def override_db():
        yield db_session

    async def override_user():
        return eboard

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def member_client(db_session: AsyncSession):
    member = _make_member_user()

    async def override_db():
        yield db_session

    async def override_user():
        return member

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
