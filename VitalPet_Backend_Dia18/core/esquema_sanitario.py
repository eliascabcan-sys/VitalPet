"""
Esquema sanitario de referencia: vacunas, desparasitaciones y antipulgas.

Es una guia GENERAL por especie y edad para recordar y ordenar las aplicaciones;
el veterinario puede ajustarla segun cada paciente (la fecha que el propio
veterinario escribe en "proxima_dosis" siempre tiene prioridad).

La funcion `calcular_esquema` es pura (no toca la base de datos) para poder
probarla con fechas fijas.
"""
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

DIAS_AVISO = 30          # "proxima": le toca dentro de los proximos 30 dias
INTERVALO_MIN_SERIE = 14 # dias minimos entre dosis de una misma serie

NOTA_REFERENCIA = (
    "Esquema de referencia general. El veterinario puede ajustarlo segun el estado "
    "y el historial de cada paciente."
)


def _norm(texto: Optional[str]) -> str:
    base = unicodedata.normalize("NFD", (texto or "").lower())
    return "".join(c for c in base if unicodedata.category(c) != "Mn")


@dataclass(frozen=True)
class ItemVacuna:
    clave: str
    nombre: str
    palabras: tuple          # palabras (sin tildes) que identifican el producto aplicado
    dosis_semanas: tuple     # edad, en semanas, a la que toca cada dosis de la serie inicial
    refuerzo_meses: int
    opcional: bool = False
    detalle: str = ""


VACUNAS = {
    "Canino": (
        ItemVacuna("polivalente_canina", "Polivalente canina (parvovirus, moquillo, hepatitis)",
                   ("polivalente", "parvo", "moquillo", "distemper", "dhpp", "dhlpp", "quintuple", "sextuple", "octuple"),
                   (8, 12, 16), 12, detalle="Serie de cachorro a las 8, 12 y 16 semanas; luego refuerzo anual."),
        ItemVacuna("rabia", "Antirrábica", ("rabia", "antirrab"), (12,), 12,
                   detalle="Primera dosis desde las 12 semanas; refuerzo anual."),
        ItemVacuna("bordetella", "Tos de las perreras (Bordetella)", ("bordetella", "tos de las perreras", "traqueobronquitis"),
                   (8,), 12, opcional=True, detalle="Recomendada si convive con otros perros o va a guarderías."),
    ),
    "Felino": (
        ItemVacuna("triple_felina", "Triple felina (panleucopenia, rinotraqueítis, calicivirus)",
                   ("triple felina", "triple", "panleucopenia", "rinotraqueitis", "calicivirus", "tetra felina", "cuadruple felina"),
                   (8, 12, 16), 12, detalle="Serie de gatito a las 8, 12 y 16 semanas; luego refuerzo anual."),
        ItemVacuna("rabia", "Antirrábica", ("rabia", "antirrab"), (12,), 12,
                   detalle="Primera dosis desde las 12 semanas; refuerzo anual."),
        ItemVacuna("leucemia_felina", "Leucemia felina (FeLV)", ("leucemia", "felv"),
                   (8, 12), 12, opcional=True, detalle="Recomendada para gatos con acceso al exterior."),
    ),
}


def tiene_esquema(especie: Optional[str]) -> bool:
    return especie in VACUNAS


def _edad_semanas(nacimiento: Optional[date], hoy: date) -> Optional[int]:
    return (hoy - nacimiento).days // 7 if nacimiento else None


def _sumar_meses(f: date, meses: int) -> date:
    m = f.month - 1 + meses
    anio, mes = f.year + m // 12, m % 12 + 1
    dia = min(f.day, [31, 29 if anio % 4 == 0 and (anio % 100 != 0 or anio % 400 == 0) else 28,
                      31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1])
    return date(anio, mes, dia)


@dataclass
class Aplicacion:
    idVacuna: int
    nombre: str
    fecha: date
    proxima_dosis: Optional[date] = None


@dataclass
class Resultado:
    clave: str
    tipo: str
    nombre: str
    opcional: bool
    detalle: str
    estado: str                      # al_dia | proxima | pendiente | vencida | opcional | sin_datos
    dosis_aplicadas: int
    dosis_total: Optional[int]       # None si no es una serie (se repite por intervalo)
    ultima_aplicacion: Optional[date]
    fecha_objetivo: Optional[date]
    dias_restantes: Optional[int]
    mensaje: str
    aplicaciones: list = field(default_factory=list)


def _clasificar(objetivo: Optional[date], hoy: date) -> tuple:
    if objetivo is None:
        return "sin_datos", None
    dias = (objetivo - hoy).days
    if dias < 0:
        return "vencida", dias
    if dias <= DIAS_AVISO:
        return "proxima", dias
    return "al_dia", dias


def _fecha_txt(f: date) -> str:
    return f.strftime("%d/%m/%Y")


def _armar(clave, tipo, nombre, opcional, detalle, apps, total, objetivo, hoy, sin_fecha=False):
    ultima = apps[-1].fecha if apps else None
    if not apps and opcional:
        estado, dias = "opcional", None
        msg = "Opcional: consulta con el veterinario si la necesita."
    elif sin_fecha:
        estado, dias = "sin_datos", None
        msg = "Registra la fecha de nacimiento de la mascota para calcular cuándo le toca."
    else:
        estado, dias = _clasificar(objetivo, hoy)
        if estado == "vencida":
            msg = f"Atrasada {abs(dias)} día(s): correspondía el {_fecha_txt(objetivo)}."
        elif estado == "proxima":
            msg = "Le toca hoy." if dias == 0 else f"Le toca en {dias} día(s), el {_fecha_txt(objetivo)}."
        else:
            msg = f"Al día. Próxima: {_fecha_txt(objetivo)}." if objetivo else "Al día."
    return Resultado(
        clave=clave, tipo=tipo, nombre=nombre, opcional=opcional, detalle=detalle, estado=estado,
        dosis_aplicadas=len(apps), dosis_total=total, ultima_aplicacion=ultima,
        fecha_objetivo=objetivo, dias_restantes=dias, mensaje=msg,
        aplicaciones=[{"idVacuna": a.idVacuna, "nombre": a.nombre, "fecha": a.fecha} for a in apps],
    )


def _vacuna(item: ItemVacuna, apps: list, nacimiento, hoy):
    coincide = [a for a in apps if any(p in _norm(a.nombre) for p in item.palabras)]
    coincide.sort(key=lambda a: a.fecha)
    n, total = len(coincide), len(item.dosis_semanas)
    if n < total:
        if coincide:
            ultima = coincide[-1]
            if ultima.proxima_dosis:                      # manda lo que dijo el veterinario
                objetivo = ultima.proxima_dosis
            elif nacimiento:                              # por edad, respetando el intervalo minimo
                objetivo = max(nacimiento + timedelta(weeks=item.dosis_semanas[n]),
                               ultima.fecha + timedelta(days=INTERVALO_MIN_SERIE))
            else:
                objetivo = ultima.fecha + timedelta(days=21)
        elif nacimiento:
            objetivo = nacimiento + timedelta(weeks=item.dosis_semanas[0])
        else:
            return _armar(item.clave, "vacuna", item.nombre, item.opcional, item.detalle, coincide, total, None, hoy, sin_fecha=True)
        return _armar(item.clave, "vacuna", item.nombre, item.opcional, item.detalle, coincide, total, objetivo, hoy)
    ultima = coincide[-1]
    objetivo = ultima.proxima_dosis or _sumar_meses(ultima.fecha, item.refuerzo_meses)
    return _armar(item.clave, "vacuna", item.nombre, item.opcional, item.detalle, coincide, total, objetivo, hoy)


def _por_intervalo(clave, tipo, nombre, detalle, apps, nacimiento, hoy, primera_dias, intervalo_fn):
    apps = sorted(apps, key=lambda a: a.fecha)
    edad = _edad_semanas(nacimiento, hoy)
    if apps:
        ultima = apps[-1]
        objetivo = ultima.proxima_dosis or (ultima.fecha + timedelta(days=intervalo_fn(edad)))
        return _armar(clave, tipo, nombre, False, detalle, apps, None, objetivo, hoy)
    if nacimiento is None:
        return _armar(clave, tipo, nombre, False, detalle, apps, None, None, hoy, sin_fecha=True)
    return _armar(clave, tipo, nombre, False, detalle, apps, None, nacimiento + timedelta(days=primera_dias), hoy)


def _intervalo_desparasitacion(edad_semanas: Optional[int]) -> int:
    if edad_semanas is None or edad_semanas >= 26:
        return 90          # adulto: cada 3 meses
    return 14 if edad_semanas < 12 else 30   # cachorro: cada 15 dias hasta los 3 meses, luego mensual


def calcular_esquema(especie, nacimiento, aplicaciones, hoy: Optional[date] = None) -> dict:
    """
    aplicaciones: dict {"vacuna": [Aplicacion], "desparasitacion": [...], "antipulgas": [...]}
    """
    hoy = hoy or date.today()
    edad = _edad_semanas(nacimiento, hoy)
    estandar = tiene_esquema(especie)
    items = []

    if estandar:
        for v in VACUNAS[especie]:
            items.append(_vacuna(v, aplicaciones.get("vacuna", []), nacimiento, hoy))

    items.append(_por_intervalo(
        "desparasitacion", "desparasitacion", "Desparasitación interna",
        "Cada 15 días hasta los 3 meses, mensual hasta los 6 meses y luego cada 3 meses.",
        aplicaciones.get("desparasitacion", []), nacimiento, hoy, 14, _intervalo_desparasitacion))
    if estandar:
        items.append(_por_intervalo(
            "antipulgas", "antipulgas", "Antipulgas y garrapatas",
            "Desde las 8 semanas; se repite según el producto (por lo general cada mes).",
            aplicaciones.get("antipulgas", []), nacimiento, hoy, 56, lambda _e: 30))

    resumen = {"al_dia": 0, "proxima": 0, "vencida": 0, "sin_datos": 0, "opcional": 0}
    for r in items:
        resumen[r.estado] = resumen.get(r.estado, 0) + 1

    nota = NOTA_REFERENCIA if estandar else (
        "Para esta especie no hay un esquema estándar de vacunación; el veterinario define "
        "las vacunas y el plan antiparasitario según el caso."
    )
    return {"edad_semanas": edad, "tiene_esquema": estandar, "nota": nota, "resumen": resumen, "items": items}
