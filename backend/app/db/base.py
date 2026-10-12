from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    SQLAlchemy 2.x Declarative Base.
    Maps existing production schema without running schema migrations or alterations.
    """
    pass
