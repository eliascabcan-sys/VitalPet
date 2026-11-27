from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class ExamenLaboratorio(Base):
    __tablename__ = "examenes_laboratorio"

    idExamen          = Column("idExamen",          Integer,     primary_key=True, index=True, autoincrement=True)
    idHistorial       = Column("idHistorial",       Integer,     ForeignKey("historial_clinico.idHistorial"), nullable=False, index=True)
    idMascota         = Column("idMascota",         Integer,     ForeignKey("mascotas.idMascota"),           nullable=False, index=True)
    idUsuarioSolicita = Column("idUsuarioSolicita", Integer,     ForeignKey("usuarios.idUsuario"),           nullable=False)
    categoria         = Column("categoria",         String(50),  nullable=False)  # hematologia | quimica | coprologia | urianalisis | imagenologia | otro
    tipo_examen       = Column("tipo_examen",       String(150), nullable=False)  # ej. Hemograma completo
    estado            = Column("estado",            String(20),  nullable=False, default="solicitado")  # solicitado | en_proceso | entregado | cancelado
    fecha_solicitud   = Column("fecha_solicitud",   DateTime,    server_default=func.now())
    fecha_resultado   = Column("fecha_resultado",   DateTime,    nullable=True)
    resultado         = Column("resultado",         Text,        nullable=True)
    valores           = Column("valores",           JSONB,       nullable=True)  # [{parametro, valor, unidad, referencia}]
    archivo_url       = Column("archivo_url",       String(500), nullable=True)
    observaciones     = Column("observaciones",     Text,        nullable=True)

    historial = relationship("HistorialClinico", back_populates="examenes")
    mascota   = relationship("Mascota")
    solicita  = relationship("User")
