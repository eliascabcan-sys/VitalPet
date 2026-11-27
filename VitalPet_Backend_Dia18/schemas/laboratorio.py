"""Laboratorio clínico: el veterinario solicita y registra resultados; el dueño solo consulta."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from core.validators import anti_xss

CATEGORIAS = ("hematologia", "quimica", "coprologia", "urianalisis", "imagenologia", "otro")
ESTADOS = ("solicitado", "en_proceso", "entregado", "cancelado")

Categoria = Literal["hematologia", "quimica", "coprologia", "urianalisis", "imagenologia", "otro"]
Estado = Literal["solicitado", "en_proceso", "entregado", "cancelado"]


def _limpio(v: Optional[str]) -> Optional[str]:
    return (anti_xss(v) or None) if v else None


class ValorExamen(BaseModel):
    """Una fila del resultado: parámetro, valor medido, unidad y rango de referencia."""
    parametro: str = Field(..., min_length=1, max_length=100)
    valor: str = Field(..., min_length=1, max_length=50)
    unidad: Optional[str] = Field(None, max_length=30)
    referencia: Optional[str] = Field(None, max_length=60)

    @field_validator("parametro", "valor", "unidad", "referencia")
    @classmethod
    def v_texto(cls, v):
        return anti_xss(v) if v else v


def _validar_url(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    v = anti_xss(v)
    if not v.lower().startswith(("http://", "https://")):
        raise ValueError("El archivo del resultado debe ser un enlace http(s).")
    return v


class ExamenCreate(BaseModel):
    idHistorial: int
    categoria: Categoria
    tipo_examen: str = Field(..., min_length=2, max_length=150)
    observaciones: Optional[str] = None

    @field_validator("tipo_examen")
    @classmethod
    def v_tipo(cls, v: str) -> str:
        limpio = anti_xss(v)
        if len(limpio) < 2:
            raise ValueError("Indica qué examen se solicita.")
        return limpio

    @field_validator("observaciones")
    @classmethod
    def v_obs(cls, v):
        return _limpio(v)


class ExamenUpdate(BaseModel):
    categoria: Optional[Categoria] = None
    tipo_examen: Optional[str] = Field(None, min_length=2, max_length=150)
    estado: Optional[Estado] = None
    resultado: Optional[str] = None
    valores: Optional[list[ValorExamen]] = None
    archivo_url: Optional[str] = Field(None, max_length=500)
    observaciones: Optional[str] = None

    @field_validator("tipo_examen", "resultado", "observaciones")
    @classmethod
    def v_texto(cls, v):
        return _limpio(v)

    @field_validator("archivo_url")
    @classmethod
    def v_url(cls, v):
        return _validar_url(v)


class ExamenOut(BaseModel):
    idExamen: int
    idHistorial: int
    idMascota: int
    nombre_mascota: Optional[str] = None
    categoria: str
    tipo_examen: str
    estado: str
    fecha_solicitud: Optional[datetime] = None
    fecha_resultado: Optional[datetime] = None
    resultado: Optional[str] = None
    valores: Optional[list[ValorExamen]] = None
    archivo_url: Optional[str] = None
    observaciones: Optional[str] = None

    class Config:
        from_attributes = True

class ExamenListaOut(ExamenOut):
    """Fila de la pantalla del laboratorio (veterinario): suma quién es el dueño y la especie."""
    nombre_dueno: Optional[str] = None
    especie: Optional[str] = None
