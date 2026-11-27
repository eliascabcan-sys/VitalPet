from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from datetime import date, datetime, time
from core.validators import anti_xss

# Cómo se solicitó/se prefiere contactar al dueño por la cita.
#   app / telefono / presencial / correo -> canales normales
#   urgente                              -> el dueño pide que lo contacten de inmediato
# (la restricción equivalente vive en vitalpet_completo.sql: ck_citas_canal)
CANALES_CONTACTO = ("app", "telefono", "presencial", "correo", "urgente")


def _validar_canal(valor: Optional[str]) -> Optional[str]:
    if valor is not None and valor not in CANALES_CONTACTO:
        raise ValueError("Canal de contacto no válido. Opciones: " + ", ".join(CANALES_CONTACTO) + ".")
    return valor


class CitaBase(BaseModel):
    # Hay dos formas de pedir una cita:
    #   1) hora exacta  -> fechaHora (la usa el personal de la clínica)
    #   2) por franja   -> fecha + idFranja (la usa el dueño: sin hora exacta)
    fechaHora: Optional[datetime] = None
    fecha: Optional[date] = None
    idFranja: Optional[int] = None
    canal_contacto: str = "app"
    motivo: Optional[str] = Field(None, max_length=500)
    estado: Optional[str] = "pendiente"
    idUsuario: int
    idMascota: int
    idVeterinario: Optional[int] = None

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, valor: Optional[str]) -> Optional[str]:
        return anti_xss(valor) if valor else valor

    @field_validator("canal_contacto")
    @classmethod
    def validar_canal(cls, valor: str) -> str:
        return _validar_canal(valor)


def _normalizar_fecha(valor: datetime) -> datetime:
    # La BD usa fechas sin zona horaria. Normalizamos entradas ISO con Z/offset.
    return valor.replace(tzinfo=None) if valor.tzinfo is not None else valor


class CitaCreate(CitaBase):
    @field_validator("fechaHora")
    @classmethod
    def validar_fecha_hora(cls, valor: Optional[datetime]) -> Optional[datetime]:
        if valor is None:
            return valor
        valor = _normalizar_fecha(valor)
        ahora = datetime.now()
        if valor < ahora:
            raise ValueError(
                f"La fecha y hora de la cita no puede ser en el pasado. "
                f"Ingresa una fecha igual o posterior a ahora: {ahora.strftime('%Y-%m-%d %H:%M')}."
            )
        return valor

    @field_validator("fecha")
    @classmethod
    def validar_fecha(cls, valor: Optional[date]) -> Optional[date]:
        if valor is not None and valor < date.today():
            raise ValueError("La fecha de la cita no puede ser en el pasado.")
        return valor

    @model_validator(mode="after")
    def validar_fecha_o_franja(self):
        if self.idFranja is not None:
            if self.fecha is None and self.fechaHora is None:
                raise ValueError("Para agendar por franja indica también la fecha de la cita.")
        elif self.fechaHora is None:
            raise ValueError("Indica la fecha y hora de la cita, o una fecha con su franja horaria.")
        return self


class CitaUpdate(BaseModel):
    fechaHora: Optional[datetime] = None
    fecha: Optional[date] = None
    idFranja: Optional[int] = None
    canal_contacto: Optional[str] = None
    motivo: Optional[str] = Field(None, max_length=500)
    estado: Optional[str] = None
    idVeterinario: Optional[int] = None

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, valor: Optional[str]) -> Optional[str]:
        return anti_xss(valor) if valor else valor

    @field_validator("canal_contacto")
    @classmethod
    def validar_canal(cls, valor: Optional[str]) -> Optional[str]:
        return _validar_canal(valor)

    @field_validator("fecha")
    @classmethod
    def validar_fecha(cls, valor: Optional[date]) -> Optional[date]:
        if valor is not None and valor < date.today():
            raise ValueError("La nueva fecha de la cita no puede ser en el pasado.")
        return valor

    @field_validator("fechaHora")
    @classmethod
    def validar_fecha_hora(cls, valor: Optional[datetime]) -> Optional[datetime]:
        if valor is None:
            return valor
        valor = _normalizar_fecha(valor)
        ahora = datetime.now()
        if valor < ahora:
            raise ValueError(
                f"La nueva fecha de la cita no puede ser en el pasado. "
                f"Ingresa una fecha igual o posterior a ahora: {ahora.strftime('%Y-%m-%d %H:%M')}."
            )
        return valor


class FranjaOut(BaseModel):
    idFranja: int
    nombre: str
    hora_inicio: time
    hora_fin: time
    cupo_maximo: int
    estado: Optional[str] = None

    class Config:
        from_attributes = True


class FranjaDisponibilidad(BaseModel):
    """Una franja con los cupos que quedan en una fecha (y veterinario) concretos."""
    idFranja: int
    nombre: str
    hora_inicio: time
    hora_fin: time
    cupo_maximo: int
    cupos_usados: int
    cupos_disponibles: int
    disponible: bool
    motivo_no_disponible: Optional[str] = None


class CitaOut(BaseModel):
    # Schema de SALIDA deliberadamente sin validaciones de futuro:
    # una cita histórica debe poder consultarse sin provocar 500.
    idCita: int
    fechaHora: datetime
    motivo: Optional[str] = None
    estado: Optional[str] = None
    idUsuario: int
    idMascota: int
    idVeterinario: Optional[int] = None
    idFranja: Optional[int] = None
    canal_contacto: Optional[str] = "app"
    franja: Optional[FranjaOut] = None

    class Config:
        from_attributes = True

class CitaListaOut(CitaOut):
    """Fila de la lista de citas del veterinario: suma los nombres para no mostrar solo IDs."""
    nombre_mascota: Optional[str] = None
    especie: Optional[str] = None
    nombre_dueno: Optional[str] = None
    nombre_veterinario: Optional[str] = None

# ----------------------------------------------------------------------
# P2: agenda del veterinario (disponibilidad por día y por semana)
# ----------------------------------------------------------------------
class CitaAgendaOut(BaseModel):
    """Una cita tal como la ve el veterinario en su agenda (con mascota y dueño)."""
    idCita: int
    fechaHora: datetime
    motivo: Optional[str] = None
    estado: Optional[str] = None
    idMascota: int
    nombre_mascota: Optional[str] = None
    especie: Optional[str] = None
    idUsuario: int
    nombre_dueno: Optional[str] = None
    idVeterinario: Optional[int] = None
    idFranja: Optional[int] = None
    canal_contacto: Optional[str] = "app"


class AgendaFranja(BaseModel):
    idFranja: int
    nombre: str
    hora_inicio: time
    hora_fin: time
    cupo_maximo: int
    cupos_usados: int
    cupos_disponibles: int
    disponible: bool
    motivo_no_disponible: Optional[str] = None
    citas: list[CitaAgendaOut] = []


class AgendaDia(BaseModel):
    fecha: date
    dia_semana: str
    total_citas: int
    franjas: list[AgendaFranja] = []
    # Citas con hora exacta (no pertenecen a ninguna franja).
    citas_hora_exacta: list[CitaAgendaOut] = []


class AgendaOut(BaseModel):
    idVeterinario: int
    nombre_veterinario: Optional[str] = None
    vista: str
    desde: date
    hasta: date
    total_citas: int
    dias: list[AgendaDia] = []


class AsignarVeterinario(BaseModel):
    idVeterinario: int
    # True: además de asignar, deja la cita confirmada.
    confirmar: bool = False


# ----------------------------------------------------------------------
# P4: citas pendientes del dueño (con mensaje listo para mostrar)
# ----------------------------------------------------------------------
class CitaPendienteOut(BaseModel):
    idCita: int
    fechaHora: datetime
    motivo: Optional[str] = None
    estado: str
    idMascota: int
    nombre_mascota: Optional[str] = None
    idVeterinario: Optional[int] = None
    nombre_veterinario: Optional[str] = None
    idFranja: Optional[int] = None
    franja: Optional[FranjaOut] = None
    canal_contacto: Optional[str] = "app"
    mensaje: str