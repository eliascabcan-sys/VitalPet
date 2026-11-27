from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date, datetime, time
from decimal import Decimal
from core.validators import anti_xss
from models.historial_seccion import TIPOS_SECCION
from schemas.formula import FormulaIn, FormulaOut


class SeccionIn(BaseModel):
    tipo: str
    contenido: Optional[str] = None

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, valor: str) -> str:
        if valor not in TIPOS_SECCION:
            raise ValueError("Sección no válida. Opciones: " + ", ".join(TIPOS_SECCION) + ".")
        return valor

    @field_validator("contenido")
    @classmethod
    def validar_contenido(cls, valor: Optional[str]) -> Optional[str]:
        return anti_xss(valor) if valor else valor


class SeccionesGuardar(BaseModel):
    secciones: list[SeccionIn]


class SeccionOut(BaseModel):
    tipo: str
    contenido: Optional[str] = None
    orden: int = 1

    class Config:
        from_attributes = True

class HistorialBase(BaseModel):
    idMascota: int
    idUsuario: Optional[int] = None
    motivo_consulta: Optional[str] = Field(None, max_length=255)
    diagnostico: Optional[str] = None
    tratamiento: Optional[str] = None
    medicamentos: Optional[str] = None
    observaciones: Optional[str] = None
    peso_consulta: Optional[Decimal] = Field(None, gt=0, description="Peso en kg durante la consulta")
    temperatura: Optional[Decimal] = Field(None, gt=0, description="Temperatura en grados Celsius")
    proxima_cita: Optional[date] = None
    frecuencia_cardiaca: Optional[int] = Field(None, ge=1, le=500, description="lpm")
    frecuencia_respiratoria: Optional[int] = Field(None, ge=1, le=300, description="rpm")
    mucosas: Optional[str] = Field(None, max_length=50)
    tllc_seg: Optional[Decimal] = Field(None, ge=0, lt=100, description="Llenado capilar en segundos")
    hidratacion: Optional[str] = Field(None, max_length=30)
    condicion_corporal: Optional[int] = Field(None, ge=1, le=9, description="Escala 1-9")

    @field_validator("motivo_consulta", "diagnostico", "tratamiento", "medicamentos", "observaciones", "mucosas", "hidratacion")
    @classmethod
    def validar_texto(cls, valor: Optional[str]) -> Optional[str]:
        return anti_xss(valor) if valor else valor


def _validar_proxima_cita(valor: Optional[date]) -> Optional[date]:
    if valor and valor <= date.today():
        raise ValueError(
            f"La proxima cita debe ser una fecha futura, no puede ser hoy ni en el pasado. "
            f"Ingresa una fecha posterior a hoy: {date.today()}."
        )
    return valor


class HistorialCreate(HistorialBase):
    # Las secciones de la hoja (anamnesis, examen, procedimientos...) viajan en
    # la misma petición para que el registro se guarde completo o no se guarde.
    secciones: list[SeccionIn] = []
    # Fórmula (antes "Tratamiento"): recomendaciones + medicamentos con dosis, frecuencia y duración.
    formula: Optional[FormulaIn] = None

    @field_validator("proxima_cita")
    @classmethod
    def validar_proxima_cita(cls, valor: Optional[date]) -> Optional[date]:
        return _validar_proxima_cita(valor)


class HistorialUpdate(BaseModel):
    motivo_consulta: Optional[str] = None
    diagnostico: Optional[str] = None
    tratamiento: Optional[str] = None
    medicamentos: Optional[str] = None
    observaciones: Optional[str] = None
    peso_consulta: Optional[Decimal] = Field(None, gt=0)
    temperatura: Optional[Decimal] = Field(None, gt=0)
    proxima_cita: Optional[date] = None
    frecuencia_cardiaca: Optional[int] = Field(None, ge=1, le=500, description="lpm")
    frecuencia_respiratoria: Optional[int] = Field(None, ge=1, le=300, description="rpm")
    mucosas: Optional[str] = Field(None, max_length=50)
    tllc_seg: Optional[Decimal] = Field(None, ge=0, lt=100, description="Llenado capilar en segundos")
    hidratacion: Optional[str] = Field(None, max_length=30)
    condicion_corporal: Optional[int] = Field(None, ge=1, le=9, description="Escala 1-9")
    estado: Optional[str] = None
    secciones: Optional[list[SeccionIn]] = None
    formula: Optional[FormulaIn] = None

    @field_validator("motivo_consulta", "diagnostico", "tratamiento", "medicamentos", "observaciones", "mucosas", "hidratacion")
    @classmethod
    def validar_texto(cls, valor: Optional[str]) -> Optional[str]:
        return anti_xss(valor) if valor else valor

    @field_validator("proxima_cita")
    @classmethod
    def validar_proxima_cita(cls, valor: Optional[date]) -> Optional[date]:
        return _validar_proxima_cita(valor)


class CitaControlOut(BaseModel):
    """Próxima cita agendada de la mascota: la "cita de control" que se muestra en la fórmula."""
    idCita: int
    fechaHora: datetime
    estado: Optional[str] = None
    motivo: Optional[str] = None
    idFranja: Optional[int] = None
    franja_nombre: Optional[str] = None
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None
    nombre_veterinario: Optional[str] = None


class HistorialOut(BaseModel):
    # Schema de SALIDA sin validacion de fechas futuras. Los historiales
    # son registros historicos y pueden tener proxima_cita antigua.
    idHistorial: int
    idMascota: int
    idUsuario: Optional[int] = None
    fechaRegistro: datetime
    motivo_consulta: Optional[str] = None
    diagnostico: Optional[str] = None
    tratamiento: Optional[str] = None
    medicamentos: Optional[str] = None
    observaciones: Optional[str] = None
    peso_consulta: Optional[Decimal] = None
    temperatura: Optional[Decimal] = None
    proxima_cita: Optional[date] = None
    estado: Optional[str] = None
    nombre_mascota: Optional[str] = None
    especie: Optional[str] = None
    raza: Optional[str] = None
    prescripcionUsada: Optional[bool] = None
    idDueno: Optional[int] = None
    idSeguimiento: Optional[int] = None
    seguimiento_creado: Optional[bool] = None
    frecuencia_cardiaca: Optional[int] = None
    frecuencia_respiratoria: Optional[int] = None
    mucosas: Optional[str] = None
    tllc_seg: Optional[Decimal] = None
    hidratacion: Optional[str] = None
    condicion_corporal: Optional[int] = None
    secciones: list[SeccionOut] = []
    # Fórmulas vigentes de la consulta (las anuladas no se muestran).
    formulas: list[FormulaOut] = []
    # True si en este registro rige la regla de "mascota nueva" (aún no hay una
    # consulta real previa): solo anamnesis y examen, sin diagnóstico.
    mascota_nueva: Optional[bool] = None
    # Próxima cita agendada de la mascota (si la hay y el registro tiene fórmula).
    cita_control: Optional[CitaControlOut] = None

    @field_validator("formulas", mode="before")
    @classmethod
    def solo_formulas_activas(cls, valor):
        return [f for f in (valor or []) if getattr(f, "estado", "activa") != "anulada"]

    class Config:
        from_attributes = True



class EstadoClinicoMascota(BaseModel):
    """Lo que el frontend necesita saber antes de abrir el formulario de historia."""
    idMascota: int
    mascota_nueva: bool
    consultas_previas: int
    campos_bloqueados: list[str] = []
    secciones_bloqueadas: list[str] = []


class PesoControlOut(BaseModel):
    idHistorial: int
    fecha: datetime
    peso_kg: Decimal

    class Config:
        from_attributes = True