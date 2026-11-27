from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from core.validators import anti_xss


TipoAplicacion = Literal["vacuna", "desparasitacion", "antipulgas"]


class VacunaBase(BaseModel):
    tipo: TipoAplicacion = "vacuna"
    nombre_vacuna: str = Field(..., min_length=2, max_length=100)
    fecha_aplicacion: date
    proxima_dosis: Optional[date] = None
    lote: Optional[str] = Field(None, max_length=50)
    veterinario: Optional[str] = Field(None, max_length=100)
    observaciones: Optional[str] = None
    idMascota: int

    @field_validator(
        "nombre_vacuna",
        "lote",
        "veterinario",
        "observaciones"
    )
    @classmethod
    def validar_texto(cls, valor: Optional[str]) -> Optional[str]:
        return anti_xss(valor) if valor else valor

    @model_validator(mode="after")
    def validar_orden_fechas(self):
        if self.proxima_dosis and self.proxima_dosis <= self.fecha_aplicacion:
            raise ValueError(
                f"La proxima dosis ({self.proxima_dosis}) debe ser una fecha "
                f"posterior a la fecha de aplicacion ({self.fecha_aplicacion})."
            )
        return self


class VacunaCreate(VacunaBase):
    pass


class VacunaUpdate(BaseModel):
    tipo: Optional[TipoAplicacion] = None
    nombre_vacuna: Optional[str] = Field(
        None,
        min_length=2,
        max_length=100
    )

    fecha_aplicacion: Optional[date] = None
    proxima_dosis: Optional[date] = None
    lote: Optional[str] = Field(None, max_length=50)
    veterinario: Optional[str] = Field(None, max_length=100)
    observaciones: Optional[str] = None
    estado: Optional[str] = None

    @field_validator(
        "nombre_vacuna",
        "lote",
        "veterinario",
        "observaciones"
    )
    @classmethod
    def validar_texto(cls, valor: Optional[str]) -> Optional[str]:
        return anti_xss(valor) if valor else valor

    @model_validator(mode="after")
    def validar_orden_fechas(self):
        if (
            self.proxima_dosis is not None
            and self.fecha_aplicacion is not None
            and self.proxima_dosis <= self.fecha_aplicacion
        ):
            raise ValueError(
                f"La proxima dosis ({self.proxima_dosis}) debe ser una fecha "
                f"posterior a la fecha de aplicacion ({self.fecha_aplicacion})."
            )
        return self


class VacunaOut(VacunaBase):
    idVacuna: int
    estado: Optional[str] = None
    nombre_mascota: Optional[str] = None

    class Config:
        from_attributes = True