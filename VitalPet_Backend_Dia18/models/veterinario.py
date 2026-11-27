from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from core.database import Base

class Veterinario(Base):
    __tablename__ = "veterinarios"

    idVeterinario       = Column("idVeterinario",       Integer,    primary_key=True, index=True, autoincrement=True)
    especialidad        = Column("especialidad",        String(100), nullable=True)
    tarjetaProfesional  = Column("tarjetaProfesional",  String(50),  unique=True, nullable=False)
    estado              = Column("estado",              String(20),  default="activo")
    # Imagen de la firma (data URL PNG/JPG). Se estampa en los certificados que emite.
    firma               = Column("firma",               Text,        nullable=True)
    idUsuario           = Column("idUsuario",           Integer,     ForeignKey("usuarios.idUsuario"), unique=True, nullable=False)

    usuario = relationship("User", back_populates="veterinario")