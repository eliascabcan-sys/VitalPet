from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String
from core.database import Base

class Product(Base):
    __tablename__ = "productos"

    idProducto           = Column("idProducto",           Integer,       primary_key=True, index=True, autoincrement=True)
    nombre_producto       = Column("nombre_producto",       String(100),   unique=True, nullable=False)
    precio                = Column("precio",                Numeric(10,2), nullable=False)
    stock                 = Column("stock",                 Integer,       default=0)
    estado                = Column("estado",                String(20),    default="activo")
    idCategoria           = Column("idCategoria",           Integer,       ForeignKey("categorias.idCategoria"), nullable=False)
    # Si es True, este producto (medicamento) solo puede venderse
    # amarrado a un historial clínico con receta activa (ver Venta).
    requierePrescripcion  = Column("requierePrescripcion",  Boolean,       nullable=False, default=False)
    idSubcategoria        = Column("idSubcategoria",        Integer,       ForeignKey("subcategorias.idSubcategoria"), nullable=True)
