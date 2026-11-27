from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from core.database import Base


class Subcategoria(Base):
    """Subcategoría de inventario (ej. categoría Medicamentos → Antibióticos)."""
    __tablename__ = "subcategorias"
    __table_args__ = (UniqueConstraint("idCategoria", "nombre_subcategoria", name="uq_subcategoria_categoria_nombre"),)

    idSubcategoria      = Column("idSubcategoria",      Integer,     primary_key=True, index=True, autoincrement=True)
    idCategoria         = Column("idCategoria",         Integer,     ForeignKey("categorias.idCategoria"), nullable=False, index=True)
    nombre_subcategoria = Column("nombre_subcategoria", String(100), nullable=False)
    estado              = Column("estado",              String(20),  nullable=False, default="activo")

    categoria = relationship("Categoria")
