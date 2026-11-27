from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DerivacionBase(BaseModel):
    idHistorialOrigen:   int
    idMascota:           int
    idVeterinarioOrigen: int
    especialidadDestino: str = Field(..., min_length=2, max_length=100)
    estado:              Optional[str] = "pendiente"


class DerivacionCreate(DerivacionBase):
    pass


class DerivacionUpdate(BaseModel):
    especialidadDestino: Optional[str] = Field(None, min_length=2, max_length=100)
    estado:              Optional[str] = None  # pendiente | aceptada | rechazada | atendida


class DerivacionOut(DerivacionBase):
    idDerivacion:  int
    fechaCreacion: Optional[datetime] = None

    class Config:
        from_attributes = True
