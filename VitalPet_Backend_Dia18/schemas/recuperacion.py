from pydantic import BaseModel, EmailStr, Field


class SolicitudRecuperacion(BaseModel):
    email: EmailStr


class RestablecerContrasena(BaseModel):
    token:      str
    contrasena: str = Field(..., min_length=10)