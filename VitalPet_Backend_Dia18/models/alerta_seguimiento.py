from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class AlertaSeguimiento(Base):
    """
    Alerta generada automaticamente cuando una respuesta activa la
    regla "nivel_alerta_si_mal" de su pregunta (RQF-30/31/32).
    """
    __tablename__ = "alertas_seguimiento"

    idAlerta               = Column("idAlerta",               Integer,  primary_key=True, index=True, autoincrement=True)
    idSeguimiento          = Column("idSeguimiento",          Integer,  ForeignKey("seguimientos.idSeguimiento"), nullable=False)
    idRespuesta            = Column("idRespuesta",            Integer,  ForeignKey("respuestas_seguimiento.idRespuesta"), nullable=False)
    nivel                  = Column("nivel",                  String(10), nullable=False)  # verde | naranja | rojo
    fecha_generada         = Column("fecha_generada",         DateTime, server_default=func.now())
    notificado_veterinario = Column("notificado_veterinario", Boolean,  default=False)
    notificado_dueno       = Column("notificado_dueno",       Boolean,  default=False)
    nivel_original         = Column("nivel_original",         String(10), nullable=True)   # nivel con el que nacio la alerta
    fecha_nivel            = Column("fecha_nivel",            DateTime,   nullable=True)   # desde cuando corre el tiempo del nivel actual (UTC)
    veces_reescalada       = Column("veces_reescalada",       Integer,    nullable=False, default=0, server_default="0")
    puntos                 = Column("puntos",                 Integer,    nullable=False, default=0, server_default="0")
    bandera_roja           = Column("bandera_roja",           Boolean,    nullable=False, default=False, server_default="false")
    # Agregada por P4 (migracion_v9_automatizacion.sql) para cumplir el punto
    # 2 del CONTRATO.md: "Las alertas ganan estado (pendiente | vista |
    # resuelta | sin_respuesta)". @P2: avisamos aquí por si quieres que viva
    # en otro lugar de tu archivo o renombrarla; no debería romper nada tuyo.
    estado                 = Column("estado",                 String(20), nullable=False, default="pendiente", server_default="pendiente")

    # Día 12 · P2: contacto directo cuando la alerta es grave (rojo). Mientras
    # fecha_contacto esté vacía, la alerta aparece en /contacto-directo/pendientes.
    fecha_contacto         = Column("fecha_contacto",         DateTime,   nullable=True)
    contactado_por         = Column("contactado_por",         Integer,    ForeignKey("usuarios.idUsuario"), nullable=True)
    canal_contacto         = Column("canal_contacto",         String(20), nullable=True)   # llamada | correo | presencial
    nota_contacto          = Column("nota_contacto",          Text,       nullable=True)

    seguimiento = relationship("Seguimiento",         back_populates="alertas")
    respuesta   = relationship("RespuestaSeguimiento", back_populates="alerta")