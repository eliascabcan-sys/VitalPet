from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import date, datetime
import re

def anti_xss(v: str) -> str:
    if v and re.search(r"<[^>]*>|javascript:|onerror|onload|onclick", v, re.IGNORECASE):
        raise ValueError("Caracteres no permitidos detectados.")
    return v.strip() if v else v

def validar_fecha_nacimiento(v):
    """No acepta fechas futuras ni imposibles (antes de 1900)."""
    if v is not None and (v > date.today() or v.year < 1900):
        raise ValueError("La fecha de nacimiento no es válida.")
    return v

class UserBase(BaseModel):
    nombre:    str = Field(..., min_length=2, max_length=100)
    apellido:  str = Field(..., min_length=2, max_length=100)
    documento: Optional[str] = None
    telefono:  Optional[str] = None
    fechaNacimiento: Optional[date] = None
    email:     EmailStr
    estado:    Optional[str] = "activo"

    @field_validator("nombre", "apellido")
    @classmethod
    def val_texto(cls, v): return anti_xss(v)

    @field_validator("fechaNacimiento")
    @classmethod
    def val_fecha_nac(cls, v): return validar_fecha_nacimiento(v)


class UserCreate(UserBase):
    contrasena: str = Field(..., min_length=10)
    # El rol NO viene del frontend — lo fuerza el backend según quién crea


class UserCreateAdmin(UserBase):
    """Solo el admin usa este schema para crear veterinarios y otros admins."""
    contrasena: str = Field(..., min_length=10)
    rol: str = Field(..., pattern="^(veterinario|administrador)$")


class UserLogin(BaseModel):
    email:     EmailStr
    contrasena: str


class UserUpdate(BaseModel):
    nombre:    Optional[str] = Field(None, min_length=2, max_length=100)
    apellido:  Optional[str] = Field(None, min_length=2, max_length=100)
    documento: Optional[str] = None
    telefono:  Optional[str] = None
    fechaNacimiento: Optional[date] = None
    email:     Optional[EmailStr] = None
    estado:    Optional[str] = None
    contrasena: Optional[str] = Field(None, min_length=10)

    @field_validator("fechaNacimiento")
    @classmethod
    def val_fecha_nac(cls, v): return validar_fecha_nacimiento(v)


class UserSelfUpdate(BaseModel):
    """Lo que un usuario autenticado puede editar de sí mismo.
    A propósito NO incluye 'rol' ni 'estado': eso solo lo cambia un administrador."""
    nombre:     Optional[str] = Field(None, min_length=2, max_length=100)
    apellido:   Optional[str] = Field(None, min_length=2, max_length=100)
    documento:  Optional[str] = None
    telefono:   Optional[str] = None
    fechaNacimiento: Optional[date] = None
    email:      Optional[EmailStr] = None
    contrasena: Optional[str] = Field(None, min_length=10)


    @field_validator("nombre", "apellido")
    @classmethod
    def val_texto(cls, v):
        return anti_xss(v) if v else v

    @field_validator("fechaNacimiento")
    @classmethod
    def val_fecha_nac(cls, v): return validar_fecha_nacimiento(v)

class UserOut(BaseModel):
    idUsuario:       int
    nombre:          str
    apellido:        str
    documento:       Optional[str] = None
    telefono:        Optional[str] = None
    fechaNacimiento: Optional[date] = None
    email:           str
    estado:          Optional[str] = "activo"
    rol:             str
    fechaCreacion:   Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type:   str
    rol:          str
    idUsuario:    int
    nombre:       str
    apellido:     str
    email:        str