from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class Seguimiento(Base):
    """
    Una plantilla "activada" sobre un historial clinico concreto
    (un diagnostico real de una mascota real). RQF-25.
    """
    __tablename__ = "seguimientos"

    idSeguimiento     = Column("idSeguimiento",     Integer,  primary_key=True, index=True, autoincrement=True)
    idHistorial       = Column("idHistorial",       Integer,  ForeignKey("historial_clinico.idHistorial"), nullable=False)
    idPlantilla       = Column("idPlantilla",       Integer,  ForeignKey("plantillas_seguimiento.idPlantilla"), nullable=False)
    fecha_diagnostico = Column("fecha_diagnostico", DateTime, server_default=func.now())
    estado            = Column("estado",            String(20), default="en_curso")  # en_curso | finalizado | cancelado

    historial  = relationship("HistorialClinico")
    plantilla  = relationship("PlantillaSeguimiento", back_populates="seguimientos")
    respuestas = relationship("RespuestaSeguimiento", back_populates="seguimiento", cascade="all, delete-orphan")
    alertas    = relationship("AlertaSeguimiento",    back_populates="seguimiento")