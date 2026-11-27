from sqlalchemy import Column, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from core.database import Base


class Vacuna(Base):
    __tablename__ = "vacunas"

    idVacuna = Column(
        "idVacuna",
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    # vacuna | desparasitacion | antipulgas (esquema sanitario)
    tipo = Column("tipo", String(20), nullable=False, default="vacuna", server_default="vacuna")

    nombre_vacuna = Column(
        "nombre_vacuna",
        String(100),
        nullable=False
    )

    fecha_aplicacion = Column(
        "fecha_aplicacion",
        Date,
        nullable=False
    )

    proxima_dosis = Column(
        "proxima_dosis",
        Date,
        nullable=True
    )

    lote = Column(
        "lote",
        String(50),
        nullable=True
    )

    veterinario = Column(
        "veterinario",
        String(100),
        nullable=True
    )

    observaciones = Column(
        "observaciones",
        Text,
        nullable=True
    )

    estado = Column(
        "estado",
        String(20),
        nullable=False,
        default="activo"
    )

    idMascota = Column(
        "idMascota",
        Integer,
        ForeignKey("mascotas.idMascota"),
        nullable=False
    )

    mascota = relationship("Mascota")