from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class HistorialClinico(Base):
    __tablename__ = "historial_clinico"

    idHistorial     = Column("idHistorial",     Integer,      primary_key=True, index=True, autoincrement=True)
    fechaRegistro   = Column("fechaRegistro",   DateTime,     server_default=func.now())
    motivo_consulta = Column("motivo_consulta", String(255),  nullable=True)
    diagnostico     = Column("diagnostico",     Text,         nullable=True)
    tratamiento     = Column("tratamiento",     Text,         nullable=True)
    medicamentos    = Column("medicamentos",    Text,         nullable=True)
    observaciones   = Column("observaciones",  Text,         nullable=True)
    peso_consulta   = Column("peso_consulta",  Numeric(5,2), nullable=True)
    temperatura     = Column("temperatura",    Numeric(4,1), nullable=True)
    proxima_cita    = Column("proxima_cita",   Date,         nullable=True)
    # Constantes del examen físico (sección "Examen físico" de la hoja)
    frecuencia_cardiaca     = Column("frecuencia_cardiaca",     Integer,      nullable=True)  # lpm
    frecuencia_respiratoria = Column("frecuencia_respiratoria", Integer,      nullable=True)  # rpm
    mucosas                 = Column("mucosas",                 String(50),   nullable=True)
    tllc_seg                = Column("tllc_seg",                Numeric(3,1), nullable=True)  # tiempo de llenado capilar
    hidratacion             = Column("hidratacion",             String(30),   nullable=True)
    condicion_corporal      = Column("condicion_corporal",      Integer,      nullable=True)  # escala 1-9
    estado          = Column("estado",         String(20),   default="activo")
    # True cuando ya se generó una Venta a partir de la receta de este
    # historial (evita reusar la misma prescripción en varias ventas).
    prescripcionUsada = Column("prescripcionUsada", Boolean, nullable=False, default=False)
    idMascota       = Column("idMascota",      Integer,      ForeignKey("mascotas.idMascota"), nullable=False)
    idUsuario       = Column("idUsuario",      Integer,      ForeignKey("usuarios.idUsuario"), nullable=False)

    mascota     = relationship("Mascota", back_populates="historial")
    veterinario = relationship("User",    back_populates="historiales")
    ventas      = relationship("Venta",   back_populates="historial")
    secciones   = relationship("HistorialSeccion", back_populates="historial", cascade="all, delete-orphan", order_by="HistorialSeccion.orden")
    formulas    = relationship("FormulaMedica",    back_populates="historial", cascade="all, delete-orphan")
    examenes    = relationship("ExamenLaboratorio", back_populates="historial")
