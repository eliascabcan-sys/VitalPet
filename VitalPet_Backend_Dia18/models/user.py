from sqlalchemy import Column, Date, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class User(Base):
    __tablename__ = "usuarios"

    idUsuario     = Column("idUsuario",     Integer,     primary_key=True, index=True, autoincrement=True)
    nombre        = Column("nombre",        String(100), nullable=False)
    apellido      = Column("apellido",      String(100), nullable=False)
    documento     = Column("documento",     String(20),  unique=True, nullable=True)
    telefono      = Column("telefono",      String(20),  nullable=True)
    fechaNacimiento = Column("fechaNacimiento", Date,      nullable=True)  # sirve para detectar adultos mayores (60+)
    email         = Column("email",         String(100), unique=True, nullable=False)
    contrasena    = Column("contrasena",    String(255), nullable=False)
    rol           = Column("rol",           String(20),  default="dueno")
    estado        = Column("estado",        String(20),  default="activo")
    fechaCreacion = Column("fechaCreacion", DateTime,    server_default=func.now())
    google_id     = Column("google_id",     String(255), unique=True, nullable=True)

    mascotas    = relationship("Mascota",          back_populates="dueno")
    citas       = relationship("Cita",             back_populates="dueno")
    historiales = relationship("HistorialClinico", back_populates="veterinario")
    ventas      = relationship("Venta",            back_populates="usuario")
    veterinario = relationship("Veterinario",      back_populates="usuario", uselist=False)
    acudientes  = relationship("Acudiente",        back_populates="dueno", cascade="all, delete-orphan")
