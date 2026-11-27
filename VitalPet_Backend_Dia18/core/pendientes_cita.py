"""
Qué le falta a una mascota antes de su cita (vacunas / desparasitación y exámenes).

Aquí solo está la LÓGICA (funciones puras, sin base de datos) para poder probarla
fácil. La consulta a la BD está en service/pendientes_cita.py.
"""

# Estados del esquema sanitario que cuentan como "falta algo", de más a menos urgente.
ORDEN_VACUNA = {"vencida": 0, "proxima": 1, "sin_datos": 2}

# Un examen sigue pendiente mientras no se haya entregado ni cancelado.
ESTADOS_EXAMEN_PENDIENTE = ("solicitado", "en_proceso")


def armar_pendientes(items_esquema: list[dict], examenes: list[dict]) -> dict:
    """items_esquema: items de EsquemaSanitarioService.de_mascota(); examenes: [{tipo_examen, estado}]."""
    vacunas = [
        {
            "nombre": it["nombre"],
            "tipo": it.get("tipo", "vacuna"),
            "estado": it["estado"],
            "mensaje": it.get("mensaje", ""),
            "fecha_objetivo": it.get("fecha_objetivo"),
        }
        for it in items_esquema
        if it["estado"] in ORDEN_VACUNA and not it.get("opcional")
    ]
    vacunas.sort(key=lambda v: ORDEN_VACUNA[v["estado"]])

    pendientes_examenes = [
        {"tipo_examen": e["tipo_examen"], "estado": e["estado"]}
        for e in examenes
        if e["estado"] in ESTADOS_EXAMEN_PENDIENTE
    ]

    total = len(vacunas) + len(pendientes_examenes)
    return {"vacunas": vacunas, "examenes": pendientes_examenes, "total": total, "al_dia": total == 0}