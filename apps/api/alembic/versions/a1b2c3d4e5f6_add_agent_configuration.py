"""add agent instructions and tool configuration"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "20ff1ee50bdb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column("instructions", sa.Text(), nullable=True),
    )
    op.add_column(
        "agents",
        sa.Column(
            "tool_config",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("agents", "tool_config")
    op.drop_column("agents", "instructions")
