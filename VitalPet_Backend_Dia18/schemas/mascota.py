from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from core.validators import anti_xss

ESPECIES_VALIDAS = ["Canino", "Felino", "Roedor", "Aves", "No convencional"]
SEXOS_VALIDOS = ["macho", "hembra"]
# Valores antiguos -> especie nueva (para no romper registros ya guardados).
_ALIAS_ESPECIE = {
    "perro": "Canino", "gato": "Felino", "conejo": "Roedor", "hamster": "Roedor",
    "pajaro": "Aves", "pájaro": "Aves", "reptil": "No convencional", "otro": "No convencional",
}


def normalizar_especie(valor: str) -> str:
    v = (valor or "").strip()
    for oficial in ESPECIES_VALIDAS:
        if v.lower() == oficial.lower():
            return oficial
    if v.lower() in _ALIAS_ESPECIE:
        return _ALIAS_ESPECIE[v.lower()]
    raise ValueError("Especie no válida. Elige: " + ", ".join(ESPECIES_VALIDAS) + ".")


def normalizar_sexo(valor: str) -> str:
    v = (valor or "").strip().lower()
    if v not in SEXOS_VALIDOS:
        raise ValueError("Sexo no válido. Elige macho o hembra.")
    return v


class MascotaBase(BaseModel):
    nombre_mascota:  str               = Field(..., min_length=2, max_length=100)
    especie:         str               = Field(..., min_length=2, max_length=50)
    raza:            Optional[str]     = Field(None, max_length=100)
    sexo:            Optional[str]     = Field(None, max_length=10, description="macho o hembra")
    color:           Optional[str]     = Field(None, max_length=50)
    peso_kg:         Optional[Decimal] = Field(None, gt=0, description="Peso en kilogramos")
    fechaNacimiento: Optional[date]    = None
    idUsuario:       int

    @field_validator("nombre_mascota", "especie")
    @classmethod
    def validar_texto(cls, valor: str) -> str:
        return anti_xss(valor)

    @field_validator("raza", "color", "sexo")
    @classmethod
    def validar_opcional(cls, valor: Optional[str]) -> Optional[str]:
        return anti_xss(valor) if valor else valor

    # ERROR 1: fecha de nacimiento no puede ser futura
    @field_validator("fechaNacimiento")
    @classmethod
    def validar_fecha_nacimiento(cls, valor: Optional[date]) -> Optional[date]:
        if valor and valor > date.today():
            raise ValueError(
                f"La fecha de nacimiento no puede ser futura. "
                f"Hoy es {date.today()}. Ingresa una fecha igual o anterior a hoy."
            )
        return valor


class MascotaCreate(MascotaBase):
    # Al crear, sexo y peso son obligatorios y la especie debe ser del catálogo.
    sexo:    str     = Field(..., max_length=10, description="macho o hembra")
    peso_kg: Decimal = Field(..., gt=0, lt=1000, description="Peso en kilogramos")

    @field_validator("especie")
    @classmethod
    def validar_especie(cls, valor: str) -> str:
        return normalizar_especie(valor)

    @field_validator("sexo")
    @classmethod
    def validar_sexo(cls, valor: str) -> str:
        return normalizar_sexo(valor)


class MascotaUpdate(BaseModel):
    nombre_mascota:  Optional[str]     = Field(None, min_length=2, max_length=100)
    especie:         Optional[str]     = Field(None, min_length=2, max_length=50)
    raza:            Optional[str]     = Field(None, max_length=100)
    sexo:            Optional[str]     = Field(None, max_length=10)
    color:           Optional[str]     = Field(None, max_length=50)
    peso_kg:         Optional[Decimal] = Field(None, gt=0, lt=1000)
    fechaNacimiento: Optional[date]    = None
    estado:          Optional[str]     = None

    @field_validator("nombre_mascota", "raza", "color")
    @classmethod
    def validar_texto(cls, valor: Optional[str]) -> Optional[str]:
        return anti_xss(valor) if valor else valor

    @field_validator("especie")
    @classmethod
    def validar_especie(cls, valor: Optional[str]) -> Optional[str]:
        return normalizar_especie(valor) if valor else valor

    @field_validator("sexo")
    @classmethod
    def validar_sexo(cls, valor: Optional[str]) -> Optional[str]:
        return normalizar_sexo(valor) if valor else valor

    @field_validator("fechaNacimiento")
    @classmethod
    def validar_fecha_nacimiento(cls, valor: Optional[date]) -> Optional[date]:
        if valor and valor > date.today():
            raise ValueError(
                f"La fecha de nacimiento no puede ser futura. "
                f"Hoy es {date.today()}. Ingresa una fecha igual o anterior a hoy."
            )
        return valor


class MascotaOut(MascotaBase):
    idMascota: int
    estado:    Optional[str] = None
    foto_url:  Optional[str] = None      # NUEVO

    class Config:
        from_attributes = True

class MascotaListaOut(MascotaOut):
    """Fila de la lista de pacientes (veterinario/admin): suma el nombre del dueño."""
    nombre_dueno: Optional[str] = None
