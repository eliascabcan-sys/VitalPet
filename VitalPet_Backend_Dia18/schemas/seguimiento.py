from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal
from datetime import datetime
from core.triaje import CODIGOS_ALERTA

NIVELES_VALIDOS = CODIGOS_ALERTA
RESPUESTAS_VALIDAS = {"bien", "regular", "mal"}
TIPOS_RESPUESTA = {"bien_regular_mal", "opciones", "texto", "numero", "si_no"}

class OpcionRespuesta(BaseModel):
    valor: str = Field(..., min_length=1, max_length=50)
    etiqueta: str = Field(..., min_length=1, max_length=100)
    puntos: int = Field(0, ge=0, le=100)
    nivel: Optional[str] = None
    bandera_roja: bool = False

    @field_validator("nivel")
    @classmethod
    def validar_nivel(cls, v):
        if v is not None and v not in NIVELES_VALIDOS:
            raise ValueError(f"nivel debe ser uno de: {', '.join(NIVELES_VALIDOS)}")
        return v

class PlantillaBase(BaseModel):
    nombre: str = Field(..., min_length=3, max_length=100)
    tipo_animal: str = Field(..., min_length=2, max_length=50)
    diagnostico: str = Field(..., min_length=2, max_length=150)

class PlantillaCreate(PlantillaBase): pass
class PlantillaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=3, max_length=100)
    tipo_animal: Optional[str] = Field(None, min_length=2, max_length=50)
    diagnostico: Optional[str] = Field(None, min_length=2, max_length=150)
    estado: Optional[str] = None

class PlantillaOut(PlantillaBase):
    idPlantilla: int
    estado: Optional[str] = None
    class Config: from_attributes = True

class PreguntaCreate(BaseModel):
    texto_pregunta: str = Field(..., min_length=5, max_length=255)
    dias_desde_diagnostico: int = Field(..., ge=0, le=365)
    orden: int = Field(1, ge=1)
    nivel_alerta_si_mal: str = Field("naranja")
    tipo_respuesta: str = Field("bien_regular_mal")
    opciones: Optional[List[OpcionRespuesta]] = None

    @field_validator("nivel_alerta_si_mal")
    @classmethod
    def validar_nivel(cls, v):
        if v not in NIVELES_VALIDOS: raise ValueError("nivel_alerta_si_mal no valido")
        return v
    @field_validator("tipo_respuesta")
    @classmethod
    def validar_tipo(cls, v):
        if v not in TIPOS_RESPUESTA: raise ValueError("tipo_respuesta no valido")
        return v

class PreguntaUpdate(BaseModel):
    texto_pregunta: Optional[str] = Field(None, min_length=5, max_length=255)
    dias_desde_diagnostico: Optional[int] = Field(None, ge=0, le=365)
    orden: Optional[int] = Field(None, ge=1)
    nivel_alerta_si_mal: Optional[str] = None
    tipo_respuesta: Optional[str] = None
    opciones: Optional[List[OpcionRespuesta]] = None
    estado: Optional[str] = None

class PreguntaOut(BaseModel):
    idPregunta: int
    idPlantilla: int
    texto_pregunta: str
    dias_desde_diagnostico: int
    orden: int
    nivel_alerta_si_mal: str
    tipo_respuesta: str = "bien_regular_mal"
    opciones: Optional[List[OpcionRespuesta]] = None
    class Config: from_attributes = True

class SeguimientoCreate(BaseModel):
    idHistorial: int
    idPlantilla: int

class SeguimientoOut(BaseModel):
    idSeguimiento: int; idHistorial: int; idPlantilla: int
    fecha_diagnostico: datetime; estado: str
    idMascota: Optional[int] = None; idDueno: Optional[int] = None
    nombre_mascota: Optional[str] = None; diagnostico: Optional[str] = None
    class Config: from_attributes = True

class ResponderPregunta(BaseModel):
    respuesta: str = Field(..., min_length=1, max_length=255)

class RespuestaOut(BaseModel):
    idRespuesta: int; idSeguimiento: int; idPregunta: int
    fecha_programada: datetime; fecha_envio: Optional[datetime] = None
    estado_envio: str; respuesta: Optional[str] = None
    fecha_respuesta: Optional[datetime] = None
    texto_pregunta: Optional[str] = None; nombre_mascota: Optional[str] = None
    idMascota: Optional[int] = None; idDueno: Optional[int] = None
    puntos: int = 0; nivel: Optional[str] = None; bandera_roja: bool = False
    tipo_respuesta: Optional[str] = None
    opciones: Optional[List[OpcionRespuesta]] = None
    class Config: from_attributes = True

class AlertaOut(BaseModel):
    idAlerta: int; idSeguimiento: int; idRespuesta: int; nivel: str
    fecha_generada: datetime; notificado_veterinario: bool; notificado_dueno: bool
    nivel_original: Optional[str] = None; fecha_nivel: Optional[datetime] = None
    veces_reescalada: int = 0; idMascota: Optional[int] = None
    nombre_mascota: Optional[str] = None; texto_pregunta: Optional[str] = None
    puntos: int = 0; bandera_roja: bool = False
    estado: str = "pendiente"
    class Config: from_attributes = True
