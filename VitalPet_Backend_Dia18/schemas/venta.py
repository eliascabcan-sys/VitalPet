from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from schemas.detalle_venta import DetalleVentaItem, DetalleVentaOut

class VentaCreate(BaseModel):
    # Opcional: si un DUEÑO llama a este endpoint, el idUsuario que mande
    # se ignora y se reemplaza por el suyo propio (ver endpoint). Solo
    # admin/veterinario pueden vender a nombre de otro dueño (venta en
    # mostrador), por eso aquí sigue siendo un campo del body.
    idUsuario: int
    items: List[DetalleVentaItem] = Field(..., min_length=1)
    # Requerido SOLO si algún item es un producto con requierePrescripcion=True.
    # Debe apuntar a un historial clínico activo, de una mascota del
    # idUsuario que compra, y que no haya sido usado en otra venta.
    idHistorial: Optional[int] = None

    @field_validator("items")
    @classmethod
    def validar_items(cls, valor: List[DetalleVentaItem]) -> List[DetalleVentaItem]:
        if not valor:
            raise ValueError("La venta debe tener al menos un producto.")
        return valor

class VentaUpdate(BaseModel):
    estado: Optional[str] = None  # pendiente -> pagada | cancelada (RQF-41)

class VentaOut(BaseModel):
    idVenta:   int
    fecha:     datetime
    total:     Decimal
    estado:    Optional[str] = None
    idUsuario: int
    idHistorial: Optional[int] = None
    detalles:  List[DetalleVentaOut] = []

    class Config:
        from_attributes = True