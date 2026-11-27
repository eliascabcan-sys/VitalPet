from sqlalchemy import Column, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship
from core.database import Base

class DetalleVenta(Base):
    __tablename__ = "detalle_venta"

    idDetalleVenta = Column("idDetalle_Venta", Integer,        primary_key=True, index=True, autoincrement=True)
    cantidad       = Column("cantidad",         Integer,        nullable=False)
    precioUnitario = Column("precioUnitario",   Numeric(10, 2), nullable=False)
    subtotal       = Column("subtotal",         Numeric(10, 2), nullable=False)
    idProducto     = Column("idProducto",       Integer,        ForeignKey("productos.idProducto"), nullable=False)
    idVenta        = Column("idVenta",          Integer,        ForeignKey("ventas.idVenta"), nullable=False)

    venta    = relationship("Venta",   back_populates="detalles")
    producto = relationship("Product")