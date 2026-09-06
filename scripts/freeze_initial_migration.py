"""Development utility: capture the initial model as explicit, immutable Alembic DDL.

Run only when bootstrapping a new repository; never regenerate a deployed revision.
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from alembic.autogenerate import produce_migrations, render_python_code
from alembic.migration import MigrationContext
from sqlalchemy import create_engine
from app.models.entities import Base

engine = create_engine("sqlite://")
with engine.connect() as connection:
    migration = produce_migrations(
        MigrationContext.configure(connection), Base.metadata
    )
    upgrade = render_python_code(migration.upgrade_ops)
    downgrade = render_python_code(migration.downgrade_ops)
text = (
    '''"""Initial BankGuard schema. Frozen DDL; do not import mutable application metadata."""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
'''
    + upgrade
    + "\n\ndef downgrade():\n"
    + downgrade
    + "\n"
)
(ROOT / "database/migrations/versions/0001_initial.py").write_text(
    text, encoding="utf-8"
)
