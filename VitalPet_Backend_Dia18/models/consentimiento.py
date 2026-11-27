from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func
from core.database import Base


class Consentimiento(Base):
    """Autorización que firma el dueño (adulto mayor) y que nombra al acudiente
    responsable. Al revocarla no se borra: queda 'vigente = False' como historial."""
    __tablename__ = "consentimientos"

    idConsentimiento = Column("idConsentimiento", Integer, primary_key=True, index=True, autoincrement=True)
    idUsuario        = Column("idUsuario",   Integer, ForeignKey("usuarios.idUsuario", ondelete="CASCADE"), nullable=False, index=True)
    idAcudiente      = Column("idAcudiente", Integer, ForeignKey("acudientes.idAcudiente"), nullable=False)
    version_texto    = Column("version_texto",   String(10), nullable=False, default="v1")
    fechaAceptacion  = Column("fechaAceptacion", DateTime,   nullable=False, server_default=func.now())
    fechaRevocacion  = Column("fechaRevocacion", DateTime,   nullable=True)
    vigente          = Column("vigente",         Boolean,    nullable=False, default=True)