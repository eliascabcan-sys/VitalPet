from pydantic import BaseModel


class NivelTriajeOut(BaseModel):
    codigo: str
    numero: int
    etiqueta: str
    nombre: str
    minutos_objetivo: int
    tiempo_texto: str
    genera_alerta: bool
    desc_veterinario: str
    desc_dueno: str

    class Config:
        from_attributes = True