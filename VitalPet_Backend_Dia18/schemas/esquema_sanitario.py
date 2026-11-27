from datetime import date
from typing import Optional

from pydantic import BaseModel


class AplicacionResumen(BaseModel):
    idVacuna: int
    nombre: str
    fecha: date


class ItemEsquemaOut(BaseModel):
    clave: str
    tipo: str                       # vacuna | desparasitacion | antipulgas
    nombre: str
    opcional: bool = False
    detalle: str = ""
    estado: str                     # al_dia | proxima | vencida | sin_datos | opcional
    dosis_aplicadas: int
    dosis_total: Optional[int] = None
    ultima_aplicacion: Optional[date] = None
    fecha_objetivo: Optional[date] = None
    dias_restantes: Optional[int] = None
    mensaje: str
    aplicaciones: list[AplicacionResumen] = []


class ResumenEsquema(BaseModel):
    al_dia: int = 0
    proxima: int = 0
    vencida: int = 0
    sin_datos: int = 0
    opcional: int = 0


class EsquemaSanitarioOut(BaseModel):
    idMascota: int
    nombre_mascota: str
    especie: str
    fechaNacimiento: Optional[date] = None
    edad_semanas: Optional[int] = None
    tiene_esquema: bool
    nota: str
    resumen: ResumenEsquema
    items: list[ItemEsquemaOut]
