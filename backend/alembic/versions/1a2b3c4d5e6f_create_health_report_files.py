"""create health_report_files

Revision ID: 1a2b3c4d5e6f
Revises: e18f6183ce26
Create Date: 2026-08-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, None] = 'e18f6183ce26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('health_report_files',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('person_id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('original_filename', sa.String(length=255), nullable=False),
    sa.Column('file_url', sa.String(length=500), nullable=False),
    sa.Column('cloudinary_public_id', sa.String(length=300), nullable=False),
    sa.Column('cloudinary_resource_type', sa.String(length=20), nullable=False),
    sa.Column('mime_type', sa.String(length=100), nullable=False),
    sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['person_id'], ['persons.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_health_report_files_person_id'), 'health_report_files', ['person_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_health_report_files_person_id'), table_name='health_report_files')
    op.drop_table('health_report_files')
