from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from core.database import Base

class Mascota(Base):
    __tablename__ = "mascotas"

    idMascota       = Column("idMascota",       Integer,       primary_key=True, index=True, autoincrement=True)
    nombre_mascota  = Column("nombre_mascota",  String(100),   nullable=False)
    especie         = Column("especie",         String(50),    nullable=False)
    raza            = Column("raza",            String(100),   nullable=True)
    sexo            = Column("sexo",            String(10),    nullable=True)  # macho | hembra (RQF-8)
    color           = Column("color",           String(50),    nullable=True)
    peso_kg         = Column("peso_kg",         Numeric(5, 2), nullable=True)
    fechaNacimiento = Column("fechaNacimiento", Date,          nullable=True)
    estado          = Column("estado",          String(20),    default="activo")
    foto            = Column("foto",            String(64),    nullable=True)  # NUEVO
    idUsuario       = Column("idUsuario",       Integer,       ForeignKey("usuarios.idUsuario"), nullable=False)

    dueno     = relationship("User",             back_populates="mascotas")
    historial = relationship("HistorialClinico", back_populates="mascota")
    citas     = relationship("Cita",             back_populates="mascota")

    @property                                                              # NUEVO
    def foto_url(self):                                                    # NUEVO
        return f"/mascotas/foto/{self.foto}" if self.foto else None        # NUEVO
