"""
Integration tests for IntakeCall CRUD via SQLAlchemy ORM and local SQLite.
Verifies create, read, update, delete and constraint behavior.
"""
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import IntegrityError

# Use in-memory SQLite for tests
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

# Import after env so database module picks up in-memory URL
from src.models.intake_call import Base, IntakeCall


@pytest.fixture
def engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def session(engine):
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def test_create_and_read(session):
    """Create an IntakeCall and read it back."""
    call = IntakeCall(
        redacted_transcript="[Redacted conversation summary.]",
        client_name_provided="Jane Doe",
        debt_details_summary="Credit cards, medical.",
        specific_legal_questions_flagged=False,
    )
    session.add(call)
    session.commit()
    assert call.call_id is not None
    assert call.start_time is not None
    assert call.end_time is not None

    found = session.get(IntakeCall, call.call_id)
    assert found is not None
    assert found.redacted_transcript == "[Redacted conversation summary.]"
    assert found.client_name_provided == "Jane Doe"
    assert found.specific_legal_questions_flagged is False


def test_update(session):
    """Update an existing IntakeCall."""
    call = IntakeCall(
        redacted_transcript="Initial transcript.",
        client_name_provided="John",
    )
    session.add(call)
    session.commit()
    call_id = call.call_id

    call.flagged_questions_summary = "Question about exemptions."
    call.specific_legal_questions_flagged = True
    session.commit()

    updated = session.get(IntakeCall, call_id)
    assert updated.flagged_questions_summary == "Question about exemptions."
    assert updated.specific_legal_questions_flagged is True


def test_delete(session):
    """Delete an IntakeCall."""
    call = IntakeCall(redacted_transcript="To be deleted.")
    session.add(call)
    session.commit()
    call_id = call.call_id
    session.delete(call)
    session.commit()

    assert session.get(IntakeCall, call_id) is None


def test_not_null_redacted_transcript(session):
    """Insert with NULL redacted_transcript must fail."""
    call = IntakeCall(
        redacted_transcript=None,
        client_name_provided="Test",
    )
    session.add(call)
    with pytest.raises(IntegrityError):
        session.commit()
