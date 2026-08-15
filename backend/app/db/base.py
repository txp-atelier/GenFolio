from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base. Every model must import this so Alembic
    autogenerate can discover it via app.db.base_models."""
