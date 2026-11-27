"""Día 12 · P2: contacto directo cuando una respuesta de seguimiento es muy mala (nivel rojo)."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from core.validators import anti_xss

CANALES_CONTACTO = ("llamada", "correo", "presencial")


class ContactoRegistrar(BaseModel):
    canal: Literal["llamada", "correo", "presencial"] = "llamada"
    nota: Optional[str] = Field(None, max_length=500)

    @field_validator("nota")
    @classmethod
    def v_nota(cls, v: Optional[str]) -> Optional[str]:
        return (anti_xss(v) or None) if v else None


class AcudienteContactoOut(BaseModel):
    nombre: str
    telefono: str
    parentesco: Optional[str] = None


class ContactoPendienteOut(BaseModel):
    idAlerta: int
    idSeguimiento: int
    idMascota: Optional[int] = None
    nombre_mascota: Optional[str] = None
    idDueno: Optional[int] = None
    nombre_dueno: Optional[str] = None
    telefono_dueno: Optional[str] = None
    email_dueno: Optional[str] = None
    # Solo si el dueño tiene consentimiento vigente (adulto mayor): a quién llamar también.
    acudiente: Optional[AcudienteContactoOut] = None
    pregunta: Optional[str] = None
    respuesta: Optional[str] = None
    fecha_generada: Optional[datetime] = None
    minutos_espera: int = 0


class ContactoRegistradoOut(BaseModel):
    idAlerta: int
    canal_contacto: str
    nota_contacto: Optional[str] = None
    fecha_contacto: datetime
    contactado_por: int
    estado: str