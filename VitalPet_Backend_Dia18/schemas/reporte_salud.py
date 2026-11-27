from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from core.validators import anti_xss


class ReporteSaludCreate(BaseModel):
    idMascota: int
    alimentacion: str = Field(..., min_length=2, max_length=50)
    actividad: str = Field(..., min_length=2, max_length=50)
    sintomas: str = Field(..., min_length=2, max_length=100)
    observaciones: Optional[str] = Field(None, max_length=1000)

    @field_validator("alimentacion", "actividad", "sintomas", "observaciones")
    @classmethod
    def validar_texto(cls, valor):
        return anti_xss(valor) if valor else valor


class ReporteSaludOut(BaseModel):
    idReporte: int
    fecha: datetime
    alimentacion: str
    actividad: str
    sintomas: str
    observaciones: Optional[str] = None
    nivel: str
    revisado: bool
    idMascota: int
    idUsuario: int
    nombre_mascota: Optional[str] = None

    class Config:
        from_attributes = True
