"""
Database connection configuration for the legal intake voice service.
Uses SQLAlchemy with SQLite for local development and storage of redacted intake records.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from src.models.intake_call import Base

# Default to local SQLite; can be overridden via env for PostgreSQL in production
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite:///./sql_app.db",
)

# SQLite needs check_same_thread=False for FastAPI/async usage; StaticPool for single-thread tests
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    poolclass=StaticPool if "sqlite" in DATABASE_URL else None,
    echo=os.environ.get("SQL_ECHO", "").lower() in ("1", "true", "yes"),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """Dependency-style session factory for use in request handlers."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables from models. Prefer Alembic migrations in production."""
    Base.metadata.create_all(bind=engine)
