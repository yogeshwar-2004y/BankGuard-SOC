"""Local database initialization. Destructive resets use the authenticated API."""

import argparse

from app.core.config import Settings
from app.core.database import database
from app.services.seed import seed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["seed"])
    parser.parse_args()
    settings = Settings()
    engine, factory = database(settings.database_url)
    with factory() as db:
        seed(db, settings)
    engine.dispose()
    print("Synthetic baseline is initialized.")


if __name__ == "__main__":
    main()
