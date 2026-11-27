from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from schemas.user import anti_xss


class AcudienteBase(BaseModel):
    nombre:     str = Field(..., min_length=2, max_length=100)
    apellido:   str = Field(..., min_length=2, max_length=100)
    documento:  Optional[str] = Field(None, max_length=20)
    telefono:   str = Field(..., min_length=7, max_length=20)
    email:      Optional[EmailStr] = None
    parentesco: Optional[str] = Field(None, max_length=50)

    @field_validator("nombre", "apellido", "parentesco")
    @classmethod
    def val_texto(cls, v): return anti_xss(v) if v else v


class AcudienteCreate(AcudienteBase):
    pass


class AcudienteUpdate(BaseModel):
    nombre:     Optional[str] = Field(None, min_length=2, max_length=100)
    apellido:   Optional[str] = Field(None, min_length=2, max_length=100)
    documento:  Optional[str] = Field(None, max_length=20)
    telefono:   Optional[str] = Field(None, min_length=7, max_length=20)
    email:      Optional[EmailStr] = None
    parentesco: Optional[str] = Field(None, max_length=50)

    @field_validator("nombre", "apellido", "parentesco")
    @classmethod
    def val_texto(cls, v): return anti_xss(v) if v else v


class AcudienteOut(AcudienteBase):
    idAcudiente: int
    autorizado:  bool
    estado:      str

    class Config:
        from_attributes = True


class ConsentimientoCreate(BaseModel):
    idAcudiente: int
    acepta: bool = Field(..., description="Debe ser true: el dueño acepta el texto del consentimiento.")


class ConsentimientoOut(BaseModel):
    idConsentimiento: int
    idAcudiente:      int
    version_texto:    str
    fechaAceptacion:  datetime
    vigente:          bool

    class Config:
        from_attributes = True


class EstadoAutorizacion(BaseModel):
    """Resumen que usa el frontend para pintar la pantalla de Autorizaciones."""
    es_adulto_mayor:        bool
    edad:                   Optional[int] = None
    fecha_nacimiento_registrada: bool
    requiere_autorizacion:  bool
    tiene_acudiente:        bool
    tiene_consentimiento:   bool
    completa:               bool
    pendientes:             list[str]
    acudientes:             list[AcudienteOut]
    consentimiento:         Optional[ConsentimientoOut] = None
    texto_consentimiento:   str