from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class FormulaMedica(Base):
    """Fórmula (receta) emitida en una consulta; agrupa uno o más medicamentos."""
    __tablename__ = "formulas_medicas"

    idFormula              = Column("idFormula",              Integer,    primary_key=True, index=True, autoincrement=True)
    idHistorial            = Column("idHistorial",            Integer,    ForeignKey("historial_clinico.idHistorial", ondelete="CASCADE"), nullable=False, index=True)
    fecha                  = Column("fecha",                  DateTime,   server_default=func.now())
    indicaciones_generales = Column("indicaciones_generales", Text,       nullable=True)
    estado                 = Column("estado",                 String(20), nullable=False, default="activa")  # activa | anulada

    historial    = relationship("HistorialClinico", back_populates="formulas")
    medicamentos = relationship("FormulaMedicamento", back_populates="formula", cascade="all, delete-orphan")


class FormulaMedicamento(Base):
    __tablename__ = "formula_medicamentos"

    idFormulaMedicamento = Column("idFormulaMedicamento", Integer,     primary_key=True, index=True, autoincrement=True)
    idFormula            = Column("idFormula",            Integer,     ForeignKey("formulas_medicas.idFormula", ondelete="CASCADE"), nullable=False, index=True)
    # Opcional: enlaza con el inventario para poder venderlo desde la fórmula.
    idProducto           = Column("idProducto",           Integer,     ForeignKey("productos.idProducto"), nullable=True)
    nombre_medicamento   = Column("nombre_medicamento",   String(150), nullable=False)
    presentacion         = Column("presentacion",         String(100), nullable=True)   # tabletas 250 mg, jarabe 60 ml...
    dosis                = Column("dosis",                String(100), nullable=False)  # 1 tableta, 0.5 ml/kg...
    via_administracion   = Column("via_administracion",   String(50),  nullable=True)   # oral, subcutánea, tópica...
    frecuencia           = Column("frecuencia",           String(100), nullable=False)  # cada 8 horas
    duracion_dias        = Column("duracion_dias",        Integer,     nullable=True)
    cantidad             = Column("cantidad",             Integer,     nullable=True)
    indicaciones         = Column("indicaciones",         Text,        nullable=True)

    formula = relationship("FormulaMedica", back_populates="medicamentos")
