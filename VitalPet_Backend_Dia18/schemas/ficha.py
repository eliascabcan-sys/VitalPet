from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from schemas.formula import FormulaOut
from schemas.historial import CitaControlOut, PesoControlOut
from schemas.laboratorio import ExamenOut


class FichaMascota(BaseModel):
    idMascota: int
    nombre_mascota: str
    especie: str
    raza: Optional[str] = None
    sexo: Optional[str] = None
    color: Optional[str] = None
    peso_kg: Optional[Decimal] = None
    fechaNacimiento: Optional[date] = None
    estado: Optional[str] = None
    foto_url: Optional[str] = None   # <-- NUEVA

    class Config:
        from_attributes = True


class FichaDueno(BaseModel):
    idUsuario: int
    nombre: str
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    documento: Optional[str] = None

    class Config:
        from_attributes = True


class FichaResumen(BaseModel):
    total_controles: int = 0
    total_formulas: int = 0
    total_examenes: int = 0
    total_aplicaciones: int = 0
    total_compras: int = 0
    total_certificados: int = 0
    ultima_consulta: Optional[datetime] = None
    peso_actual: Optional[Decimal] = None


class FichaControl(BaseModel):
    """Una consulta/control, con lo que se anotó en la hoja de historia."""
    idHistorial: int
    fecha: datetime
    motivo_consulta: Optional[str] = None
    diagnostico: Optional[str] = None
    tratamiento: Optional[str] = None
    observaciones: Optional[str] = None
    peso_consulta: Optional[Decimal] = None
    temperatura: Optional[Decimal] = None
    frecuencia_cardiaca: Optional[int] = None
    frecuencia_respiratoria: Optional[int] = None
    mucosas: Optional[str] = None
    hidratacion: Optional[str] = None
    condicion_corporal: Optional[int] = None
    proxima_cita: Optional[date] = None
    nombre_veterinario: Optional[str] = None
    # Secciones de la hoja
    anamnesis: Optional[str] = None
    examen_fisico: Optional[str] = None
    procedimientos: Optional[str] = None
    inyectologia: Optional[str] = None


class FichaFormula(FormulaOut):
    diagnostico: Optional[str] = None


class FichaAplicacion(BaseModel):
    idVacuna: int
    nombre: str
    fecha_aplicacion: date
    proxima_dosis: Optional[date] = None
    lote: Optional[str] = None
    veterinario: Optional[str] = None
    observaciones: Optional[str] = None


class FichaInyeccion(BaseModel):
    idHistorial: int
    fecha: datetime
    contenido: str


class FichaCompraItem(BaseModel):
    nombre_producto: str
    cantidad: int
    subtotal: Decimal


class FichaCompra(BaseModel):
    idVenta: int
    fecha: Optional[datetime] = None
    total: Decimal
    estado: Optional[str] = None
    idHistorial: Optional[int] = None
    items: list[FichaCompraItem] = []


class FichaCita(BaseModel):
    idCita: int
    fechaHora: datetime
    estado: Optional[str] = None
    motivo: Optional[str] = None
    franja: Optional[str] = None
    nombre_veterinario: Optional[str] = None


class FichaCertificado(BaseModel):
    idCertificado: int
    codigo: str
    tipo: str
    fechaEmision: Optional[datetime] = None
    vigenciaHasta: Optional[date] = None
    estado: str
    lote: Optional[str] = None

    class Config:
        from_attributes = True


class FichaPacienteOut(BaseModel):
    mascota: FichaMascota
    dueno: Optional[FichaDueno] = None
    resumen: FichaResumen
    controles: list[FichaControl] = []
    formulas: list[FichaFormula] = []
    laboratorio: list[ExamenOut] = []
    vacunas: list[FichaAplicacion] = []
    desparasitaciones: list[FichaAplicacion] = []
    antipulgas: list[FichaAplicacion] = []
    inyecciones: list[FichaInyeccion] = []
    compras: list[FichaCompra] = []
    citas: list[FichaCita] = []
    certificados: list[FichaCertificado] = []
    pesos: list[PesoControlOut] = []
    # Próxima cita agendada (la misma "cita de control" que se imprime en la fórmula).
    cita_control: Optional[CitaControlOut] = None
