"""create memories table

Revision ID: 53b798828052
Revises: c72a0fd2bd07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "53b798828052"
down_revision: Union[str, Sequence[str], None] = "c72a0fd2bd07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "memories",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column(
            "agent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agents.id"),
            nullable=True,
        ),
        sa.Column(
            "type",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "key",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "value",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_memories_organization_id",
        "memories",
        ["organization_id"],
    )

    op.create_index(
        "ix_memories_user_id",
        "memories",
        ["user_id"],
    )

    op.create_index(
        "ix_memories_agent_id",
        "memories",
        ["agent_id"],
    )

    op.create_index(
        "ix_memories_type",
        "memories",
        ["type"],
    )

    op.create_index(
        "ix_memories_key",
        "memories",
        ["key"],
    )


def downgrade() -> None:
    op.drop_index("ix_memories_key", table_name="memories")
    op.drop_index("ix_memories_type", table_name="memories")
    op.drop_index("ix_memories_agent_id", table_name="memories")
    op.drop_index("ix_memories_user_id", table_name="memories")
    op.drop_index("ix_memories_organization_id", table_name="memories")

    op.drop_table("memories")
