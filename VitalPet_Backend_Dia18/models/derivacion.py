from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class Derivacion(Base):
    """
    Derivación de un caso clínico a un especialista.
    Se crea cuando el veterinario general, desde un historial clínico
    (idHistorialOrigen), decide pasar el caso de una mascota a otro
    veterinario/especialidad (especialidadDestino).
    """
    __tablename__ = "derivaciones"

    idDerivacion        = Column("idDerivacion",        Integer,     primary_key=True, index=True, autoincrement=True)
    idHistorialOrigen   = Column("idHistorialOrigen",   Integer,     ForeignKey("historial_clinico.idHistorial"), nullable=False)
    idMascota           = Column("idMascota",           Integer,     ForeignKey("mascotas.idMascota"),            nullable=False)
    # idVeterinarioOrigen apunta a usuarios.idUsuario (no a veterinarios.idVeterinario),
    # igual que HistorialClinico.idUsuario, para mantener el mismo patrón del proyecto.
    idVeterinarioOrigen = Column("idVeterinarioOrigen", Integer,     ForeignKey("usuarios.idUsuario"),    nullable=False)
    especialidadDestino = Column("especialidadDestino", String(100), nullable=False)
    estado               = Column("estado",              String(20),  default="pendiente")  # pendiente | agendada | atendida
    fechaCreacion        = Column("fechaCreacion",       DateTime,    server_default=func.now())

    historial_origen   = relationship("HistorialClinico")
    mascota             = relationship("Mascota")
    veterinario_origen = relationship("User")