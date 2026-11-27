from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class Venta(Base):
    __tablename__ = "ventas"

    idVenta     = Column("idVenta",     Integer,       primary_key=True, index=True, autoincrement=True)
    fecha       = Column("fecha",       DateTime,      server_default=func.now())
    total       = Column("total",       Numeric(10, 2), nullable=False, default=0)
    estado      = Column("estado",      String(20),    default="pendiente")
    idUsuario   = Column("idUsuario",   Integer,       ForeignKey("usuarios.idUsuario"), nullable=False)
    # Opcional: historial clínico que justifica la receta cuando la
    # venta incluye al menos un producto que requierePrescripcion.
    idHistorial = Column("idHistorial", Integer,       ForeignKey("historial_clinico.idHistorial"), nullable=True)

    usuario   = relationship("User", back_populates="ventas")
    detalles  = relationship("DetalleVenta", back_populates="venta", cascade="all, delete-orphan")
    historial = relationship("HistorialClinico", back_populates="ventas")