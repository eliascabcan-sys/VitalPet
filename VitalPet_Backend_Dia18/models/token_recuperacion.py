from sqlalchemy import Boolean, Column, DateTime, Integer, String
from core.database import Base

class TokenRecuperacion(Base):
    __tablename__ = "tokens_recuperacion"

    idToken   = Column("idToken",   Integer,     primary_key=True, autoincrement=True)
    email     = Column("email",     String(100), nullable=False)
    token     = Column("token",     String(255), nullable=False, unique=True)
    expira_en = Column("expira_en", DateTime,    nullable=False)
    usado     = Column("usado",     Boolean,     default=False)