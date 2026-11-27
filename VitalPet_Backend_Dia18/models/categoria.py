from sqlalchemy import Column, Integer, String
from core.database import Base

class Categoria(Base):
    __tablename__ = "categorias"

    idCategoria      = Column("idCategoria",      Integer,     primary_key=True, index=True, autoincrement=True)
    nombre_categoria = Column("nombre_categoria",  String(100), unique=True, nullable=False)
    estado           = Column("estado",            String(20),  default="activo")
