from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from core.database import Base


class Cita(Base):
    __tablename__ = "citas"

    idCita         = Column("idCita",         Integer,     primary_key=True, index=True, autoincrement=True)
    fechaHora      = Column("fechaHora",      DateTime,    nullable=False)
    motivo         = Column("motivo",         Text,        nullable=True)
    estado         = Column("estado",         String(20),  default="pendiente")  # pendiente|confirmada|cancelada|atendida
    idUsuario      = Column("idUsuario",      Integer,     ForeignKey("usuarios.idUsuario"), nullable=False)   # dueno que agenda
    idMascota      = Column("idMascota",      Integer,     ForeignKey("mascotas.idMascota"), nullable=False)
    idVeterinario  = Column("idVeterinario",  Integer,     ForeignKey("veterinarios.idVeterinario"), nullable=True)  # RQF-20
    # Cita por franja: el dueño elige la franja (mañana/tarde) en vez de una hora exacta.
    idFranja       = Column("idFranja",       Integer,     ForeignKey("franjas_horarias.idFranja"), nullable=True)
    # Cómo se solicitó la cita: app | telefono | presencial | correo
    canal_contacto = Column("canal_contacto", String(20),  nullable=False, default="app")
    recordatorio_enviado = Column("recordatorio_enviado",Boolean, nullable=False,default=False)

    dueno       = relationship("User",        back_populates="citas")
    mascota     = relationship("Mascota",     back_populates="citas")
    veterinario = relationship("Veterinario")
    franja      = relationship("FranjaHoraria")
