from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def database(url: str):
    options = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
        if url == "sqlite://":
            options["poolclass"] = StaticPool
    engine = create_engine(url, **options)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    return engine, sessionmaker(engine, expire_on_commit=False)


def get_db(request):
    with request.app.state.db() as db:
        yield db
