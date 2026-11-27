import re
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from core.validators import anti_xss

TIPOS_CERTIFICADO = ("salud", "vacunacion", "viaje", "esterilizacion", "defuncion", "otro")

# Imagen de la firma: PNG o JPG en base64 (data URL). Tope para no llenar la base de datos.
_FIRMA_RE = re.compile(r"^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$")
FIRMA_MAX_CARACTERES = 300_000


class CertificadoCreate(BaseModel):
    idMascota: int
    tipo: str
    contenido: str = Field(..., max_length=3000)
    idHistorial: Optional[int] = None
    vigenciaHasta: Optional[date] = None
    lote: Optional[str] = Field(None, max_length=50)

    @field_validator("tipo")
    @classmethod
    def v_tipo(cls, v: str) -> str:
        if v not in TIPOS_CERTIFICADO:
            raise ValueError("Tipo de certificado no válido. Opciones: " + ", ".join(TIPOS_CERTIFICADO) + ".")
        return v

    @field_validator("contenido")
    @classmethod
    def v_contenido(cls, v: str) -> str:
        limpio = anti_xss(v or "")
        if not limpio:
            raise ValueError("El contenido del certificado es obligatorio.")
        return limpio

    @field_validator("lote")
    @classmethod
    def v_lote(cls, v: Optional[str]) -> Optional[str]:
        return (anti_xss(v) or None) if v else None

    @field_validator("vigenciaHasta")
    @classmethod
    def v_vigencia(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v < date.today():
            raise ValueError("La vigencia del certificado no puede estar en el pasado.")
        return v


class CertificadoAnular(BaseModel):
    motivo: str = Field(..., max_length=500)

    @field_validator("motivo")
    @classmethod
    def v_motivo(cls, v: str) -> str:
        limpio = anti_xss(v or "")
        if len(limpio) < 5:
            raise ValueError("Escribe el motivo de la anulación (mínimo 5 caracteres).")
        return limpio


class FirmaIn(BaseModel):
    firma: str

    @field_validator("firma")
    @classmethod
    def v_firma(cls, v: str) -> str:
        if len(v) > FIRMA_MAX_CARACTERES:
            raise ValueError("La imagen de la firma es muy pesada. Usa una imagen de menos de 200 KB.")
        if not _FIRMA_RE.match(v):
            raise ValueError("La firma debe ser una imagen PNG o JPG.")
        return v


class FirmaEstado(BaseModel):
    registrada: bool
    firma: Optional[str] = None


class CertificadoOut(BaseModel):
    idCertificado: int
    codigo: str
    codigo_verificacion: Optional[str] = None
    tipo: str
    idMascota: int
    idHistorial: Optional[int] = None
    idUsuario: int
    fechaEmision: Optional[datetime] = None
    vigenciaHasta: Optional[date] = None
    contenido: str
    estado: str
    mascota_nombre: Optional[str] = None
    mascota_especie: Optional[str] = None
    mascota_raza: Optional[str] = None
    dueno_nombre: Optional[str] = None
    nombre_veterinario: Optional[str] = None
    tarjeta_profesional: Optional[str] = None
    firma_veterinario: Optional[str] = None
    lote: Optional[str] = None
    motivo_anulacion: Optional[str] = None
    fechaAnulacion: Optional[datetime] = None
    # False si el contenido guardado ya no coincide con la huella con que se emitió.
    integro: bool = True

    class Config:
        from_attributes = True

class VerificacionOut(BaseModel):
    """Lo ÚNICO que ve el público al verificar un certificado (sin contenido ni datos del dueño)."""
    valido: bool
    estado: str                         # emitido | anulado
    integro: bool
    vigente: bool
    mensaje: str
    codigo: str
    tipo: str
    fechaEmision: Optional[datetime] = None
    vigenciaHasta: Optional[date] = None
    fechaAnulacion: Optional[datetime] = None
    mascota_nombre: Optional[str] = None
    mascota_especie: Optional[str] = None
    nombre_veterinario: Optional[str] = None
    tarjeta_profesional: Optional[str] = None
    lote: Optional[str] = None
