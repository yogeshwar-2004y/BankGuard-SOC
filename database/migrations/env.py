from alembic import context
from app.core.config import Settings
from app.core.database import database
from app.models.entities import Base

config = context.config
target_metadata = Base.metadata
url = Settings().database_url
if context.is_offline_mode():
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine, _ = database(url)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=engine.dialect.name == "sqlite",
        )
        with context.begin_transaction():
            context.run_migrations()
