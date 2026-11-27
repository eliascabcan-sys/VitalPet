from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class VeterinarioBase(BaseModel):
    especialidad:       Optional[str] = None
    tarjetaProfesional: str = Field(..., min_length=3, max_length=50)


class VeterinarioCreate(VeterinarioBase):
    """
    RQF-16: solo un administrador la usa. Trae junto los datos de login
    del Usuario (nombre/apellido/documento/telefono/email/contrasena) y
    los datos profesionales, porque el servicio crea ambos registros en
    una sola transaccion.
    """
    nombre:     str = Field(..., min_length=2, max_length=100)
    apellido:   str = Field(..., min_length=2, max_length=100)
    documento:  Optional[str] = Field(None, max_length=20)
    telefono:   Optional[str] = Field(None, max_length=20)
    email:      EmailStr
    contrasena: str = Field(..., min_length=10)


class VeterinarioUpdate(BaseModel):
    """
    El administrador solo puede tocar los datos profesionales y,
    opcionalmente, resetear la contrasena fija. Nombre/apellido/email
    del veterinario se editan desde /users, no desde aqui.
    """
    especialidad:       Optional[str] = None
    tarjetaProfesional: Optional[str] = Field(None, min_length=3, max_length=50)
    contrasena:         Optional[str] = Field(None, min_length=10)


class VeterinarioOut(VeterinarioBase):
    idVeterinario: int
    estado:        str
    idUsuario:     int
    nombre:        Optional[str] = None
    apellido:      Optional[str] = None
    email:         Optional[str] = None

    class Config:
        from_attributes = True