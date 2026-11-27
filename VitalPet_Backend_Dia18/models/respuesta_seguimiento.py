from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from core.database import Base

class RespuestaSeguimiento(Base):
    __tablename__ = "respuestas_seguimiento"
    idRespuesta = Column("idRespuesta", Integer, primary_key=True, index=True, autoincrement=True)
    idSeguimiento = Column("idSeguimiento", Integer, ForeignKey("seguimientos.idSeguimiento"), nullable=False)
    idPregunta = Column("idPregunta", Integer, ForeignKey("preguntas_plantilla.idPregunta"), nullable=False)
    fecha_programada = Column("fecha_programada", DateTime, nullable=False)
    fecha_envio = Column("fecha_envio", DateTime, nullable=True)
    estado_envio = Column("estado_envio", String(20), default="pendiente")
    respuesta = Column("respuesta", String(255), nullable=True)
    fecha_respuesta = Column("fecha_respuesta", DateTime, nullable=True)
    puntos = Column("puntos", Integer, nullable=False, default=0, server_default="0")
    nivel = Column("nivel", String(10), nullable=True)
    bandera_roja = Column("bandera_roja", Boolean, nullable=False, default=False, server_default="false")
    seguimiento = relationship("Seguimiento", back_populates="respuestas")
    pregunta = relationship("PreguntaPlantilla", back_populates="respuestas")
    alerta = relationship("AlertaSeguimiento", back_populates="respuesta", uselist=False)
