from sqlalchemy import Column, Integer, String, Time
from core.database import Base


class FranjaHoraria(Base):
    """Franja de atención (ej. Mañana 08:00–12:00). Las citas se agendan por franja."""
    __tablename__ = "franjas_horarias"

    idFranja     = Column("idFranja",     Integer,    primary_key=True, index=True, autoincrement=True)
    nombre       = Column("nombre",       String(50), nullable=False, unique=True)
    hora_inicio  = Column("hora_inicio",  Time,       nullable=False)
    hora_fin     = Column("hora_fin",     Time,       nullable=False)
    cupo_maximo  = Column("cupo_maximo",  Integer,    nullable=False, default=6)  # citas por franja y por veterinario
    estado       = Column("estado",       String(20), nullable=False, default="activo")
