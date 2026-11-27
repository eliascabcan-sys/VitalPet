from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from core.database import Base


class Acudiente(Base):
    """Persona de contacto/responsable alterna de un dueño (familiar, cuidador...)."""
    __tablename__ = "acudientes"

    idAcudiente = Column("idAcudiente", Integer,     primary_key=True, index=True, autoincrement=True)
    idUsuario   = Column("idUsuario",   Integer,     ForeignKey("usuarios.idUsuario", ondelete="CASCADE"), nullable=False, index=True)
    nombre      = Column("nombre",      String(100), nullable=False)
    apellido    = Column("apellido",    String(100), nullable=False)
    documento   = Column("documento",   String(20),  nullable=True)
    telefono    = Column("telefono",    String(20),  nullable=False)
    email       = Column("email",       String(100), nullable=True)
    parentesco  = Column("parentesco",  String(50),  nullable=True)
    autorizado  = Column("autorizado",  Boolean,     nullable=False, default=True)  # puede recoger/autorizar procedimientos
    estado      = Column("estado",      String(20),  nullable=False, default="activo")

    dueno = relationship("User", back_populates="acudientes")
