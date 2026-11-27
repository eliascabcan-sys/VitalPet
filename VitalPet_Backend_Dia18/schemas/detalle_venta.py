from pydantic import BaseModel, Field
from decimal import Decimal
from typing import Optional

class DetalleVentaItem(BaseModel):
    idProducto: int
    cantidad:   int = Field(..., gt=0)

class DetalleVentaOut(BaseModel):
    idDetalleVenta: int
    idProducto:     int
    cantidad:       int
    precioUnitario: Decimal
    subtotal:       Decimal
    nombre_producto: Optional[str] = None
    requierePrescripcion: Optional[bool] = None

    class Config:
        from_attributes = True