# Database commands:  flask --app run init-db | seed | reset-db
# (staff/customer import commands are in staff_import.py)
import click
from flask import current_app
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL, make_url

from .extensions import db


# ---- Helpers ----
def create_database_if_missing():
    """MySQL only: CREATE DATABASE so you don't have to do it by hand."""
    url = make_url(current_app.config["SQLALCHEMY_DATABASE_URI"])
    if not url.drivername.startswith("mysql"):
        return
    # same server/login, but no database selected (it may not exist yet)
    server = create_engine(URL.create(url.drivername, url.username, url.password, url.host, url.port, query=url.query))
    with server.connect() as conn:
        conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{url.database}` "
                          "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
    server.dispose()
    click.echo(f"Database '{url.database}' is ready.")


def add_missing_columns():
    """create_all() never changes existing tables; add any new model columns so old databases keep working."""
    insp = inspect(db.engine)
    with db.engine.begin() as conn:
        for table in db.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            existing = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in existing:
                    continue
                ddl = f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col.type.compile(db.engine.dialect)}"
                if col.unique and db.engine.dialect.name != "sqlite":
                    ddl += " UNIQUE"
                conn.execute(text(ddl))
                click.echo(f"Added column {table.name}.{col.name}")


# ---- Command registration ----
def register_cli(app):
    from . import staff_import
    staff_import.register(app)

    # Safe to run any time: creates what's missing, never deletes data
    @app.cli.command("init-db")
    def init_db():
        """Create the MySQL database (if needed), all tables, and any new columns."""
        create_database_if_missing()
        db.create_all()
        add_missing_columns()
        click.echo("Tables created.")

    @app.cli.command("seed")
    def seed_cmd():
        """Fill an empty database with sample data."""
        from .seed import seed
        seed()

    # DANGER: wipes the whole database (asks for confirmation)
    @app.cli.command("reset-db")
    @click.confirmation_option(prompt="This drops ALL tables and data. Continue?")
    def reset_db():
        """Drop everything, recreate tables and reseed."""
        from .seed import seed
        create_database_if_missing()
        db.drop_all()
        db.create_all()
        seed()
