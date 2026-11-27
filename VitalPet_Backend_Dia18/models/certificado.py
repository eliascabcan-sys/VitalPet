from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class Certificado(Base):
    __tablename__ = "certificados"

    idCertificado = Column("idCertificado", Integer,     primary_key=True, index=True, autoincrement=True)
    codigo        = Column("codigo",        String(30),  unique=True, nullable=False)  # número verificable, ej. CERT-2026-000001
    tipo          = Column("tipo",          String(30),  nullable=False)  # salud | vacunacion | viaje | esterilizacion | defuncion | otro
    idMascota     = Column("idMascota",     Integer,     ForeignKey("mascotas.idMascota"), nullable=False, index=True)
    idHistorial   = Column("idHistorial",   Integer,     ForeignKey("historial_clinico.idHistorial"), nullable=True)
    idUsuario     = Column("idUsuario",     Integer,     ForeignKey("usuarios.idUsuario"), nullable=False)  # veterinario que emite
    fechaEmision  = Column("fechaEmision",  DateTime,    server_default=func.now())
    vigenciaHasta = Column("vigenciaHasta", Date,        nullable=True)
    contenido     = Column("contenido",     Text,        nullable=False)
    estado        = Column("estado",        String(20),  nullable=False, default="emitido")  # emitido | anulado

    # --- Datos congelados al emitir ------------------------------------------
    # Se copian al momento de emitir: si luego se edita la mascota o el perfil
    # del veterinario, el certificado ya emitido NO cambia.
    mascota_nombre      = Column("mascota_nombre",      String(100), nullable=True)
    mascota_especie     = Column("mascota_especie",     String(50),  nullable=True)
    mascota_raza        = Column("mascota_raza",        String(100), nullable=True)
    dueno_nombre        = Column("dueno_nombre",        String(150), nullable=True)
    nombre_veterinario  = Column("nombre_veterinario",  String(150), nullable=True)
    tarjeta_profesional = Column("tarjeta_profesional", String(50),  nullable=True)
    firma_veterinario   = Column("firma_veterinario",   Text,        nullable=True)  # imagen (data URL), opcional
    lote                = Column("lote",                String(50),  nullable=True)  # lote del biológico/medicamento

    # --- Verificación y no-edición -------------------------------------------
    # codigo_verificacion: lo escribe quien verifica el certificado (día 8: verificación pública).
    # huella: SHA-256 del contenido; si alguien altera la base de datos, deja de coincidir.
    codigo_verificacion = Column("codigo_verificacion", String(16), unique=True, nullable=True)
    huella              = Column("huella",              String(64),  nullable=True)
    motivo_anulacion    = Column("motivo_anulacion",    Text,        nullable=True)
    fechaAnulacion      = Column("fechaAnulacion",      DateTime,    nullable=True)

    mascota     = relationship("Mascota")
    historial   = relationship("HistorialClinico")
    veterinario = relationship("User")
