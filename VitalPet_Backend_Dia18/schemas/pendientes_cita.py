from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class PendienteVacunaOut(BaseModel):
    nombre: str
    tipo: str                      # vacuna | desparasitacion | antipulgas
    estado: str                    # vencida | proxima | sin_datos
    mensaje: str
    fecha_objetivo: Optional[date] = None


class PendienteExamenOut(BaseModel):
    tipo_examen: str
    estado: str                    # solicitado | en_proceso


class PreparacionCitaOut(BaseModel):
    """Lo que le falta a la mascota antes de una cita (para 'Mis citas' del dueño)."""
    idCita: int
    idMascota: int
    nombre_mascota: str
    fechaHora: datetime
    vacunas: list[PendienteVacunaOut]
    examenes: list[PendienteExamenOut]
    total: int
    al_dia: bool