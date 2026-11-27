"""Día 12 · P1: respuestas de la consulta de stock desde la fórmula."""
from typing import Literal, Optional

from pydantic import BaseModel

EstadoStock = Literal["disponible", "bajo", "agotado"]
EstadoMedicamento = Literal["disponible", "insuficiente", "agotado", "sin_inventario"]


class ProductoStockOut(BaseModel):
    idProducto: int
    nombre_producto: str
    stock: int
    estado_stock: EstadoStock
    requierePrescripcion: bool = False
    idCategoria: int
    nombre_categoria: Optional[str] = None
    idSubcategoria: Optional[int] = None
    nombre_subcategoria: Optional[str] = None
    # Cuántas unidades hay en total de ese "tipo" (misma subcategoría; si el
    # producto no tiene, la misma categoría sin subcategoría).
    productos_del_tipo: int
    unidades_del_tipo: int


class MedicamentoStockOut(BaseModel):
    idFormulaMedicamento: int
    nombre_medicamento: str
    cantidad_requerida: Optional[int] = None
    en_inventario: bool
    estado: EstadoMedicamento
    faltan: int = 0                       # unidades que no alcanzan (0 si alcanza)
    producto: Optional[ProductoStockOut] = None


class FormulaStockOut(BaseModel):
    idFormula: int
    hay_faltantes: bool
    medicamentos: list[MedicamentoStockOut]