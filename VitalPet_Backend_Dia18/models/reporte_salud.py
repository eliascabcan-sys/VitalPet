from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class ReporteSalud(Base):
    __tablename__ = "reportes_salud"

    idReporte = Column("idReporte", Integer, primary_key=True, index=True, autoincrement=True)
    fecha = Column("fecha", DateTime, server_default=func.now(), nullable=False)
    alimentacion = Column("alimentacion", String(50), nullable=False)
    actividad = Column("actividad", String(50), nullable=False)
    sintomas = Column("sintomas", String(100), nullable=False)
    observaciones = Column("observaciones", Text, nullable=True)
    nivel = Column("nivel", String(10), nullable=False, default="verde")
    revisado = Column("revisado", Boolean, nullable=False, default=False)
    idMascota = Column("idMascota", Integer, ForeignKey("mascotas.idMascota"), nullable=False)
    idUsuario = Column("idUsuario", Integer, ForeignKey("usuarios.idUsuario"), nullable=False)

    mascota = relationship("Mascota")
    usuario = relationship("User")
