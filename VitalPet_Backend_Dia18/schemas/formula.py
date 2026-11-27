from datetime import datetime
from typing import Optional

from pydantic import AliasChoices, BaseModel, Field, field_validator

from core.validators import anti_xss


def _texto_obligatorio(valor: str, nombre: str) -> str:
    limpio = anti_xss(valor or "")
    if not limpio:
        raise ValueError(f"{nombre}: campo obligatorio.")
    return limpio


class MedicamentoIn(BaseModel):
    """Medicamento, dosis, frecuencia y duración son obligatorios."""
    idProducto: Optional[int] = None
    nombre_medicamento: str = Field(..., max_length=150)
    presentacion: Optional[str] = Field(None, max_length=100)
    dosis: str = Field(..., max_length=100)
    via_administracion: Optional[str] = Field(None, max_length=50)
    frecuencia: str = Field(..., max_length=100)
    duracion_dias: int = Field(..., ge=1, le=365)
    cantidad: Optional[int] = Field(None, ge=1)
    indicaciones: Optional[str] = None

    @field_validator("nombre_medicamento")
    @classmethod
    def v_med(cls, v: str) -> str:
        return _texto_obligatorio(v, "El medicamento")

    @field_validator("dosis")
    @classmethod
    def v_dosis(cls, v: str) -> str:
        return _texto_obligatorio(v, "La dosis")

    @field_validator("frecuencia")
    @classmethod
    def v_frec(cls, v: str) -> str:
        return _texto_obligatorio(v, "La frecuencia")

    @field_validator("presentacion", "via_administracion", "indicaciones")
    @classmethod
    def v_opc(cls, v: Optional[str]) -> Optional[str]:
        return (anti_xss(v) or None) if v else None


class FormulaIn(BaseModel):
    recomendaciones: Optional[str] = None
    medicamentos: list[MedicamentoIn] = Field(..., min_length=1)

    @field_validator("recomendaciones")
    @classmethod
    def v_rec(cls, v: Optional[str]) -> Optional[str]:
        return (anti_xss(v) or None) if v else None


class FormulaCreate(FormulaIn):
    idHistorial: int


class MedicamentoOut(BaseModel):
    idFormulaMedicamento: int
    idProducto: Optional[int] = None
    nombre_medicamento: str
    presentacion: Optional[str] = None
    dosis: str
    via_administracion: Optional[str] = None
    frecuencia: str
    duracion_dias: Optional[int] = None
    cantidad: Optional[int] = None
    indicaciones: Optional[str] = None

    class Config:
        from_attributes = True


class FormulaOut(BaseModel):
    idFormula: int
    idHistorial: int
    fecha: Optional[datetime] = None
    recomendaciones: Optional[str] = Field(
        None, validation_alias=AliasChoices("recomendaciones", "indicaciones_generales")
    )
    estado: str = "activa"
    medicamentos: list[MedicamentoOut] = []

    class Config:
        from_attributes = True
        populate_by_name = True