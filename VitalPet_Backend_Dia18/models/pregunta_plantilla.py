from sqlalchemy import Column, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import relationship
from core.database import Base


class PreguntaPlantilla(Base):
    """Pregunta configurable del motor de seguimiento.

    ``opciones`` usa JSON para permitir respuestas configurables. Formato:
    [{"valor":"bien","etiqueta":"Bien","puntos":0,"nivel":"verde","bandera_roja":false}, ...]

    Las filas antiguas pueden dejar ``opciones`` en NULL y seguir usando
    bien/regular/mal mediante la compatibilidad implementada en el servicio.
    """
    __tablename__ = "preguntas_plantilla"

    idPregunta = Column("idPregunta", Integer, primary_key=True, index=True, autoincrement=True)
    idPlantilla = Column("idPlantilla", Integer, ForeignKey("plantillas_seguimiento.idPlantilla"), nullable=False)
    texto_pregunta = Column("texto_pregunta", String(255), nullable=False)
    dias_desde_diagnostico = Column("dias_desde_diagnostico", Integer, nullable=False)
    orden = Column("orden", Integer, default=1)
    nivel_alerta_si_mal = Column("nivel_alerta_si_mal", String(10), default="naranja")
    tipo_respuesta = Column("tipo_respuesta", String(30), nullable=False, default="bien_regular_mal", server_default="bien_regular_mal")
    opciones = Column("opciones", JSON, nullable=True)
    estado = Column("estado", String(20), default="activo")

    plantilla = relationship("PlantillaSeguimiento", back_populates="preguntas")
    respuestas = relationship("RespuestaSeguimiento", back_populates="pregunta")
