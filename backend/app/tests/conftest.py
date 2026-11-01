import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.models.base import Base
import app.models  # noqa: F401
from app.models.user import User
from app.core.database import get_db
from app.core.rate_limit import rate_limiter
from app.api.deps import get_current_user, get_current_active_user
from app.main import app

# StaticPool ensures that all connections share the same in-memory SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def init_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def reset_rate_limits():
    rate_limiter.reset()
    yield
    rate_limiter.reset()


@pytest.fixture(scope="function")
def db():
    session = TestingSessionLocal()
    try:
        # Ensure default test user exists
        user = session.query(User).filter(User.id == "00000000-0000-0000-0000-000000000001").first()
        if not user:
            user = User(
                id="00000000-0000-0000-0000-000000000001",
                email="admin@eventplanner.com",
                hashed_password="mock_hashed_pw",
                full_name="Default Test Admin",
                is_active=True,
                is_superuser=True,
            )
            session.add(user)
            session.commit()
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(scope="function")
def default_user(db):
    return db.query(User).filter(User.id == "00000000-0000-0000-0000-000000000001").first()


@pytest.fixture(scope="function")
def client(db, default_user):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    def override_get_current_user():
        return default_user

    def override_get_current_active_user():
        return default_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user

    with TestClient(app, raise_server_exceptions=True) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def unauthenticated_client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()
