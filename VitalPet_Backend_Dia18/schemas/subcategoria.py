from typing import Optional

from pydantic import BaseModel, Field, field_validator

from core.validators import anti_xss


class SubcategoriaCreate(BaseModel):
    idCategoria: int
    nombre_subcategoria: str = Field(..., min_length=2, max_length=100)

    @field_validator("nombre_subcategoria")
    @classmethod
    def validar_nombre(cls, v: str) -> str:
        return anti_xss(v)


class SubcategoriaUpdate(BaseModel):
    nombre_subcategoria: Optional[str] = Field(None, min_length=2, max_length=100)

    @field_validator("nombre_subcategoria")
    @classmethod
    def validar_nombre(cls, v: Optional[str]) -> Optional[str]:
        return anti_xss(v) if v else v


class SubcategoriaOut(BaseModel):
    idSubcategoria: int
    idCategoria: int
    nombre_subcategoria: str
    estado: str

    class Config:
        from_attributes = True


class StockTipoOut(BaseModel):
    """Unidades en inventario agrupadas por categoría y subcategoría."""
    idCategoria: int
    nombre_categoria: str
    idSubcategoria: Optional[int] = None
    nombre_subcategoria: Optional[str] = None   # None = productos sin subcategoría
    productos: int
    unidades: int