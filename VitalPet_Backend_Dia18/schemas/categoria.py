from pydantic import BaseModel, Field, field_validator
from typing import Optional
from core.validators import anti_xss


class CategoriaBase(BaseModel):
    nombre_categoria: str = Field(..., min_length=2, max_length=100)
    estado: Optional[str] = "activo"

    @field_validator("nombre_categoria")
    @classmethod
    def validar_nombre(cls, valor: str) -> str:
        return anti_xss(valor)


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(BaseModel):
    nombre_categoria: Optional[str] = Field(None, min_length=2, max_length=100)
    estado: Optional[str] = None


class CategoriaOut(CategoriaBase):
    idCategoria: int

    class Config:
        from_attributes = True
