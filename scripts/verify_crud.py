#!/usr/bin/env python3
"""
One-off script to verify IntakeCall CRUD against the local SQLite database.
Run from project root with: python scripts/verify_crud.py
"""
import sys
import os

# Ensure project root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import SessionLocal, init_db
from src.models import IntakeCall


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        # Create
        call = IntakeCall(
            redacted_transcript="[Verification run: redacted transcript.]",
            client_name_provided="CRUD Test",
            debt_details_summary="Test debt summary",
            specific_legal_questions_flagged=False,
        )
        db.add(call)
        db.commit()
        db.refresh(call)
        print(f"Created: call_id={call.call_id}")

        # Read
        found = db.get(IntakeCall, call.call_id)
        assert found and found.client_name_provided == "CRUD Test"
        print("Read: OK")

        # Update
        found.income_details_summary = "Updated income summary"
        db.commit()
        db.refresh(found)
        assert found.income_details_summary == "Updated income summary"
        print("Update: OK")

        # Delete
        db.delete(found)
        db.commit()
        assert db.get(IntakeCall, call.call_id) is None
        print("Delete: OK")

        print("CRUD verification passed.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
