from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

# Secciones de la historia clínica (la "hoja de Word"). El menú lateral del
# frontend se arma con esta misma lista.
TIPOS_SECCION = (
    "anamnesis",
    "examen_fisico",
    "diagnostico_presuntivo",
    "plan_diagnostico",
    "diagnostico_definitivo",
    "tratamiento",
    "pronostico",
    "recomendaciones",
    "evolucion",
    "procedimientos",
    "inyectologia",
)

# Secciones que forman parte del "diagnóstico". Una mascota nueva (sin ninguna
# consulta real previa) solo puede tener anamnesis y examen: estas quedan
# bloqueadas hasta el siguiente control. Para cambiar la regla basta editar
# esta tupla (y CAMPOS_DIAGNOSTICO en service/historial.py).
SECCIONES_DIAGNOSTICO = (
    "diagnostico_presuntivo",
    "plan_diagnostico",
    "diagnostico_definitivo",
)


class HistorialSeccion(Base):
    __tablename__ = "historial_secciones"
    __table_args__ = (UniqueConstraint("idHistorial", "tipo", name="uq_historial_seccion_tipo"),)

    idSeccion     = Column("idSeccion",     Integer,     primary_key=True, index=True, autoincrement=True)
    idHistorial   = Column("idHistorial",   Integer,     ForeignKey("historial_clinico.idHistorial", ondelete="CASCADE"), nullable=False, index=True)
    tipo          = Column("tipo",          String(40),  nullable=False)
    contenido     = Column("contenido",     Text,        nullable=True)
    orden         = Column("orden",         Integer,     nullable=False, default=1)
    actualizadoEn = Column("actualizadoEn", DateTime,    server_default=func.now(), onupdate=func.now())

    historial = relationship("HistorialClinico", back_populates="secciones")
