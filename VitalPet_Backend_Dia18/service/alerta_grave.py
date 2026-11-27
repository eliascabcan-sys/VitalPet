"""
Alerta GRAVE (nivel rojo): correo inmediato al dueño y a la clínica.

Se llama desde los tres sitios donde puede nacer una alerta roja:
- el reporte de salud que envía el dueño,
- la respuesta a una pregunta de seguimiento,
- una alerta que sube a rojo por no atenderse a tiempo.
Un fallo al enviar correos NUNCA debe romper la operación principal.
"""
import logging

from sqlalchemy.orm import Session

from core import clinica
from core.email import enviar_email_alerta_grave_clinica, enviar_email_alerta_grave_dueno
from core.triaje import ROJO
from models.mascota import Mascota
from models.user import User

logger = logging.getLogger("vitalpet.alerta_grave")


def es_grave(nivel: str | None) -> bool:
    return nivel == ROJO


def correos_de_la_clinica(db: Session) -> list[str]:
    """Veterinarios y administradores activos + el correo general de la clínica (sin repetir)."""
    personal = db.query(User).filter(
        User.rol.in_(["veterinario", "administrador"]),
        User.estado == "activo",
    ).all()
    correos = [u.email for u in personal if u.email]
    if clinica.CLINICA_EMAIL:
        correos.append(clinica.CLINICA_EMAIL)
    vistos: dict[str, str] = {}
    for c in correos:
        vistos.setdefault(c.strip().lower(), c.strip())
    return list(vistos.values())


def notificar_alerta_grave(db: Session, mascota: Mascota, motivo: str, origen: str) -> dict:
    """Envía los correos y devuelve cuántos salieron: {"dueno": bool, "clinica": n}."""
    from service.automatizacion import _run_async  # import local: evita un ciclo de imports

    resultado = {"dueno": False, "clinica": 0}
    try:
        dueno = mascota.dueno
        nombre_dueno = f"{dueno.nombre} {dueno.apellido or ''}".strip() if dueno else "Dueño"

        if dueno and dueno.email:
            _run_async(enviar_email_alerta_grave_dueno(
                dueno.email, dueno.nombre, mascota.nombre_mascota, motivo, clinica.CLINICA_TELEFONO,
            ))
            resultado["dueno"] = True

        for correo in correos_de_la_clinica(db):
            _run_async(enviar_email_alerta_grave_clinica(
                correo, mascota.nombre_mascota, nombre_dueno,
                dueno.telefono if dueno else None, motivo, origen,
            ))
            resultado["clinica"] += 1
    except Exception as exc:
        logger.error("No se pudo notificar la alerta grave de la mascota %s: %s", getattr(mascota, "idMascota", "?"), exc)
    return resultado
def preparar_notificacion_alerta_grave(db: Session, mascota: Mascota, motivo: str, origen: str):
    """
    Reúne los datos con la sesión abierta y devuelve una función `enviar()` que manda
    los correos SIN usar la base de datos, para ejecutarla en segundo plano.
    """
    from service.automatizacion import _run_async  # import local: evita un ciclo de imports

    try:
        dueno = mascota.dueno
        nombre_dueno = f"{dueno.nombre} {dueno.apellido or ''}".strip() if dueno else "Dueño"
        email_dueno = dueno.email if dueno else None
        nombre_pila = dueno.nombre if dueno else None
        telefono_dueno = dueno.telefono if dueno else None
        nombre_mascota = mascota.nombre_mascota
        correos = correos_de_la_clinica(db)
    except Exception as exc:
        logger.error("No se pudo preparar la alerta grave de la mascota %s: %s", getattr(mascota, "idMascota", "?"), exc)
        return lambda: None

    def enviar():
        try:
            if email_dueno:
                _run_async(enviar_email_alerta_grave_dueno(
                    email_dueno, nombre_pila, nombre_mascota, motivo, clinica.CLINICA_TELEFONO,
                ))
            for correo in correos:
                _run_async(enviar_email_alerta_grave_clinica(
                    correo, nombre_mascota, nombre_dueno, telefono_dueno, motivo, origen,
                ))
        except Exception as exc:
            logger.error("No se pudo enviar la alerta grave de la mascota %s: %s", nombre_mascota, exc)

    return enviar