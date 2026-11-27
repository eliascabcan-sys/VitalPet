from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from core.database import Base


class PlantillaSeguimiento(Base):
    """
    Define, por especie + diagnostico, que preguntas se le haran
    al dueno despues de la consulta (RQF-25/26).
    """
    __tablename__ = "plantillas_seguimiento"

    idPlantilla = Column("idPlantilla", Integer,     primary_key=True, index=True, autoincrement=True)
    nombre      = Column("nombre",      String(100), nullable=False)
    tipo_animal = Column("tipo_animal", String(50),  nullable=False)  # especie: perro, gato, etc.
    diagnostico = Column("diagnostico", String(150), nullable=False)  # diagnostico/condicion asociada
    estado      = Column("estado",      String(20),  default="activo")

    preguntas    = relationship("PreguntaPlantilla", back_populates="plantilla", cascade="all, delete-orphan")
    seguimientos = relationship("Seguimiento",        back_populates="plantilla")