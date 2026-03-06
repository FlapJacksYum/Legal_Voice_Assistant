"""create intake_calls table

Revision ID: 20260305_0000
Revises:
Create Date: 2026-03-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260305_0000"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "intake_calls",
        sa.Column("call_id", sa.String(36), primary_key=True),
        sa.Column("start_time", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("end_time", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("redacted_transcript", sa.Text(), nullable=False),
        sa.Column("client_name_provided", sa.String(255), nullable=True),
        sa.Column("debt_details_summary", sa.Text(), nullable=True),
        sa.Column("income_details_summary", sa.Text(), nullable=True),
        sa.Column("asset_details_summary", sa.Text(), nullable=True),
        sa.Column("specific_legal_questions_flagged", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("flagged_questions_summary", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("intake_calls")
