"""
Escala de triaje de Manchester adaptada a VitalPet (5 niveles).

Es la unica fuente de verdad de los niveles: clasificar(), las alertas de
seguimiento, el reescalado y el endpoint GET /triaje/niveles leen de aqui.
"""
from dataclasses import dataclass
from typing import Optional

# Codigos de nivel (son los mismos valores que se guardan en la BD)
ROJO = "rojo"
NARANJA = "naranja"
AMARILLO = "amarillo"
VERDE = "verde"
AZUL = "azul"


@dataclass(frozen=True)
class NivelTriaje:
    codigo: str               # valor que se guarda en la BD
    numero: int               # 1 = mas urgente ... 5 = menos urgente
    etiqueta: str             # "Rojo"
    nombre: str               # "Emergencia"
    minutos_objetivo: int     # tiempo maximo para atender antes de reescalar
    tiempo_texto: str         # texto para mostrar en pantalla
    genera_alerta: bool       # False = no aparece como alerta para el veterinario
    desc_veterinario: str
    desc_dueno: str


# Ordenados de MAS urgente a MENOS urgente. subir_nivel() depende de este orden.
NIVELES = (
    NivelTriaje(
        codigo=ROJO, numero=1, etiqueta="Rojo", nombre="Emergencia",
        minutos_objetivo=0, tiempo_texto="Atención inmediata", genera_alerta=True,
        desc_veterinario=(
            "Riesgo vital inminente: dificultad respiratoria severa, convulsiones, "
            "trauma grave o hemorragia activa. Se atiende de inmediato, sin espera."
        ),
        desc_dueno=(
            "Algo grave está pasando: dificultad para respirar, convulsiones o sangrado. "
            "Contacta a la clínica de inmediato, no esperes la respuesta del sistema."
        ),
    ),
    NivelTriaje(
        codigo=NARANJA, numero=2, etiqueta="Naranja", nombre="Muy urgente",
        minutos_objetivo=10, tiempo_texto="Máx. 10 minutos", genera_alerta=True,
        desc_veterinario=(
            "Signos que pueden comprometer la vida si no se atienden pronto: "
            "vómito con sangre, decaimiento extremo, dolor intenso."
        ),
        desc_dueno=(
            "Signos que preocupan bastante: vómito con sangre, dolor intenso o "
            "decaimiento extremo. Te contactarán muy pronto."
        ),
    ),
    NivelTriaje(
        codigo=AMARILLO, numero=3, etiqueta="Amarillo", nombre="Urgente",
        minutos_objetivo=60, tiempo_texto="Máx. 60 minutos", genera_alerta=True,
        desc_veterinario=(
            "Condición estable pero que requiere valoración pronta: diarrea persistente, "
            "fiebre, poco apetito por varios días."
        ),
        desc_dueno=(
            "Algo no está bien pero no es una emergencia: diarrea, fiebre o poco apetito "
            "por varios días. Se agendará una consulta pronto."
        ),
    ),
    NivelTriaje(
        codigo=VERDE, numero=4, etiqueta="Verde", nombre="Estándar",
        minutos_objetivo=120, tiempo_texto="Máx. 2 horas", genera_alerta=True,
        desc_veterinario=(
            "Condición leve: cambios menores de comportamiento o apetito, sin otros "
            "signos de alarma. Se agenda consulta o seguimiento normal."
        ),
        desc_dueno=(
            "Cambios leves y sin señales de alarma. Se hace seguimiento normal, sin urgencia."
        ),
    ),
    NivelTriaje(
        # Azul = todo normal. No genera alerta, asi que nunca se reescala;
        # los 240 min (valor de Manchester) solo completan la tabla.
        codigo=AZUL, numero=5, etiqueta="Azul", nombre="No urgente",
        minutos_objetivo=240, tiempo_texto="Consulta de rutina", genera_alerta=False,
        desc_veterinario=(
            "La mascota reporta estar bien. Corresponde a controles de rutina, "
            "vacunación o chequeos programados."
        ),
        desc_dueno=(
            "Tu mascota está bien. Este nivel corresponde a controles de rutina o "
            "vacunación programada."
        ),
    ),
)

_POR_CODIGO = {n.codigo: n for n in NIVELES}

# Los 5 codigos, de mas a menos urgente
CODIGOS = tuple(n.codigo for n in NIVELES)

# Solo los que pueden ser una alerta (todos menos azul). Se usa para validar
# el "nivel_alerta_si_mal" de las preguntas de seguimiento.
CODIGOS_ALERTA = tuple(n.codigo for n in NIVELES if n.genera_alerta)


def obtener_nivel(codigo: Optional[str]) -> Optional[NivelTriaje]:
    """Devuelve el NivelTriaje de un codigo, o None si no existe."""
    if not codigo:
        return None
    return _POR_CODIGO.get(codigo.strip().lower())


def genera_alerta(codigo: Optional[str]) -> bool:
    nivel = obtener_nivel(codigo)
    return bool(nivel and nivel.genera_alerta)


def subir_nivel(codigo: str) -> str:
    """
    Devuelve el codigo del nivel inmediatamente mas urgente
    (azul -> verde -> amarillo -> naranja -> rojo). Rojo se queda en rojo.
    """
    nivel = obtener_nivel(codigo)
    if nivel is None:
        raise ValueError(f"Nivel de triaje desconocido: {codigo!r}")
    indice = nivel.numero - 1              # posicion actual en NIVELES
    return NIVELES[max(indice - 1, 0)].codigo