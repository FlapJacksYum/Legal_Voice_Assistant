"""
IntakeCall ORM model for storing redacted client intake call records.
Schema aligns with FRBP 9037 and attorney review requirements.
"""
import uuid
from sqlalchemy import Boolean, Column, DateTime, String, Text, func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""
    pass


class IntakeCall(Base):
    """
    Redacted intake call record: transcript and summaries only.
    Raw audio and unredacted text must not be persisted; only DLP-redacted content.
    """
    __tablename__ = "intake_calls"

    call_id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    start_time = Column(DateTime(timezone=False), nullable=False, server_default=func.now())
    end_time = Column(DateTime(timezone=False), nullable=False, server_default=func.now(), onupdate=func.now())
    redacted_transcript = Column(Text, nullable=False)
    client_name_provided = Column(String(255), nullable=True)
    debt_details_summary = Column(Text, nullable=True)
    income_details_summary = Column(Text, nullable=True)
    asset_details_summary = Column(Text, nullable=True)
    specific_legal_questions_flagged = Column(Boolean, nullable=False, default=False)
    flagged_questions_summary = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<IntakeCall(call_id='{self.call_id}', start_time='{self.start_time}')>"
