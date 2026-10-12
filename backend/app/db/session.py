from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.core.logging import logger

# Modern SQLAlchemy 2.0 Engine
# pool_pre_ping=True verifies connections before checkout
engine = create_engine(
    settings.sqlalchemy_database_uri,
    pool_pre_ping=True,
    echo=False,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding an isolated database session with guaranteed cleanup.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> tuple[bool, str]:
    """
    Ping the PostgreSQL database to verify connectivity.
    Returns (is_connected, details_or_error_message).
    Never exposes credentials or raw connection strings.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, "Database connection operational"
    except Exception as exc:
        logger.warning(f"Database health check failed: {str(exc)}")
        # Return generic safe message without secrets
        return False, "Database connection unreachable"
