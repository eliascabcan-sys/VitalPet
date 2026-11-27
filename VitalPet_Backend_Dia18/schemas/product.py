from pydantic import BaseModel, Field, field_validator
from typing import Optional
from decimal import Decimal
from core.validators import anti_xss


class ProductBase(BaseModel):
    nombre_producto: str     = Field(..., min_length=3, max_length=100)
    precio:          Decimal = Field(..., gt=0)
    stock:           int     = Field(..., ge=0)
    estado:          Optional[str] = "activo"
    idCategoria:     int
    requierePrescripcion: Optional[bool] = False
    idSubcategoria:  Optional[int] = None

    @field_validator("nombre_producto")
    @classmethod
    def validar_nombre(cls, valor: str) -> str:
        return anti_xss(valor)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    nombre_producto: Optional[str]     = Field(None, min_length=3, max_length=100)
    precio:          Optional[Decimal] = Field(None, gt=0)
    stock:           Optional[int]     = Field(None, ge=0)
    estado:          Optional[str]     = None
    idCategoria:     Optional[int]     = None
    requierePrescripcion: Optional[bool] = None

    @field_validator("nombre_producto")
    @classmethod
    def validar_nombre(cls, valor: Optional[str]) -> Optional[str]:
        return anti_xss(valor) if valor else valor


class ProductOut(ProductBase):
    idProducto: int

    class Config:
        from_attributes = True
