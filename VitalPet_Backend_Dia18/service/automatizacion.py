"""
service/automatizacion.py
RESPONSABILIDAD (P4): todo lo que pasa "solo", sin que nadie le dé clic:
1) Enviar por correo las preguntas de seguimiento que ya tocan.
2) Reintentar (6h, 12h) a quien no respondió; después, marcar vencida
y crear una alerta "sin_respuesta" para el veterinario.
3) Reescalar alertas vencidas en su tiempo objetivo (función de P2,
core/triaje.py + service/triaje.py) y avisar al veterinario cuando
una alerta llega a rojo.

Este módulo no decide umbrales de triaje (eso es de P2, en core/triaje.py);
solo orquesta envíos y llama a lo que P2 y P3 ya construyeron.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload

from core.email import enviar_email_pregunta_seguimiento, enviar_email_alerta_veterinario
from core.triaje import ROJO
from models.respuesta_seguimiento import RespuestaSeguimiento
from models.seguimiento import Seguimiento
from models.historial import HistorialClinico
from models.mascota import Mascota
from models.alerta_seguimiento import AlertaSeguimiento
from models.user import User
from service.triaje import reescalar_alertas
from service.alerta_grave import notificar_alerta_grave

# Umbrales de reintento. Están en horas para poder acortarlos por entorno
# (ver AUTOMATIZACION_*_HORAS en core/config a través de variables de entorno)
# y poder hacer una demo en minutos de algo que en producción tarda horas.
import os

HORAS_REINTENTO_1 = float(os.getenv("AUTOMATIZACION_REINTENTO_1_HORAS", "6"))
HORAS_REINTENTO_2 = float(os.getenv("AUTOMATIZACION_REINTENTO_2_HORAS", "12"))
HORAS_VENCIMIENTO = float(os.getenv("AUTOMATIZACION_VENCIMIENTO_HORAS", "18"))


def _ahora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _run_async(coro):
    """
    Permite llamar funciones async (fastapi-mail) tanto desde un job del
    scheduler (sin event loop corriendo) como desde un endpoint async
    (con event loop ya corriendo), sin duplicar código en cada sitio.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        asyncio.run(coro)
    else:
        loop.create_task(coro)


def _notificar_dueno(dueno: User, email_coro_factory) -> bool:
    """Envía el aviso por correo. Devuelve False si el dueño no tiene email."""
    if dueno and dueno.email:
        _run_async(email_coro_factory())
        return True
    return False


def _notificar_veterinarios(db: Session, nombre_mascota: str, nivel: str, motivo: str):
    """Avisa por correo a todos los usuarios con rol veterinario o administrador."""
    staff = db.query(User).filter(User.rol.in_(["veterinario", "administrador"])).all()
    for u in staff:
        if u.email:
            _run_async(enviar_email_alerta_veterinario(u.email, nombre_mascota, nivel, motivo))


# ── 1) Envío de preguntas que ya tocan ──────────────────────────────────────
def enviar_preguntas_programadas(db: Session) -> dict:
    ahora = _ahora()
    pendientes = (
        db.query(RespuestaSeguimiento)
        .join(Seguimiento)
        .join(HistorialClinico)
        .join(HistorialClinico.mascota)
        .options(
            joinedload(RespuestaSeguimiento.seguimiento)
            .joinedload(Seguimiento.historial)
            .joinedload(HistorialClinico.mascota)
            .joinedload(Mascota.dueno),
            joinedload(RespuestaSeguimiento.pregunta),
        )
        .filter(
            RespuestaSeguimiento.estado_envio == "pendiente",
            RespuestaSeguimiento.fecha_programada <= ahora,
        )
        .all()
    )

    enviadas = 0
    for r in pendientes:
        mascota = r.seguimiento.historial.mascota
        dueno = mascota.dueno
        texto = r.pregunta.texto_pregunta

        if _notificar_dueno(
            dueno,
            lambda: enviar_email_pregunta_seguimiento(dueno.email, dueno.nombre, mascota.nombre_mascota, texto),
        ):
            enviadas += 1

        r.estado_envio = "enviada"
        r.fecha_envio = ahora

    if pendientes:
        db.commit()

    return {"revisadas": len(pendientes), "notificadas": enviadas}


# ── 2) Reintentos y vencimiento ─────────────────────────────────────────────
def _crear_alerta_sin_respuesta(db: Session, respuesta: RespuestaSeguimiento):
    alerta = AlertaSeguimiento(
        idSeguimiento=respuesta.idSeguimiento,
        idRespuesta=respuesta.idRespuesta,
        nivel="naranja",  # no sabemos qué tan grave es; se trata como urgente
        nivel_original="naranja",
        fecha_nivel=_ahora(),
        estado="sin_respuesta",
    )
    db.add(alerta)

    mascota = respuesta.seguimiento.historial.mascota
    _notificar_veterinarios(
        db, mascota.nombre_mascota, "naranja",
        f"El dueño no respondió la pregunta de seguimiento ({HORAS_VENCIMIENTO:.0f}h sin respuesta).",
    )


def procesar_reintentos_y_vencimiento(db: Session) -> dict:
    ahora = _ahora()
    en_curso = (
        db.query(RespuestaSeguimiento)
        .join(Seguimiento)
        .join(HistorialClinico)
        .join(HistorialClinico.mascota)
        .options(
            joinedload(RespuestaSeguimiento.seguimiento)
            .joinedload(Seguimiento.historial)
            .joinedload(HistorialClinico.mascota)
            .joinedload(Mascota.dueno),
            joinedload(RespuestaSeguimiento.pregunta),
        )
        .filter(RespuestaSeguimiento.estado_envio.in_(["enviada", "reintento_1", "reintento_2"]))
        .all()
    )

    reintentadas, vencidas = 0, 0
    for r in en_curso:
        if r.fecha_envio is None:
            continue
        horas_pasadas = (ahora - r.fecha_envio).total_seconds() / 3600
        mascota = r.seguimiento.historial.mascota
        dueno = mascota.dueno
        texto = r.pregunta.texto_pregunta

        if r.estado_envio == "enviada" and horas_pasadas >= HORAS_REINTENTO_1:
            _notificar_dueno(
                dueno,
                lambda: enviar_email_pregunta_seguimiento(dueno.email, dueno.nombre, mascota.nombre_mascota, texto),
            )
            r.estado_envio = "reintento_1"
            reintentadas += 1

        elif r.estado_envio == "reintento_1" and horas_pasadas >= HORAS_REINTENTO_2:
            _notificar_dueno(
                dueno,
                lambda: enviar_email_pregunta_seguimiento(dueno.email, dueno.nombre, mascota.nombre_mascota, texto),
            )
            r.estado_envio = "reintento_2"
            reintentadas += 1

        elif r.estado_envio == "reintento_2" and horas_pasadas >= HORAS_VENCIMIENTO:
            r.estado_envio = "vencida"
            _crear_alerta_sin_respuesta(db, r)
            vencidas += 1

    if en_curso:
        db.commit()

    return {"reintentadas": reintentadas, "vencidas": vencidas}


# ── 3) Reescalado (de P2) + aviso al veterinario cuando llega a rojo ────────
def reescalar_y_notificar(db: Session) -> dict:
    subidas = reescalar_alertas(db)

    notificadas = 0
    for alerta in subidas:
        if alerta.nivel == ROJO:
            mascota = alerta.seguimiento.historial.mascota if alerta.seguimiento and alerta.seguimiento.historial else None
            nombre_mascota = mascota.nombre_mascota if mascota else f"Mascota (alerta #{alerta.idAlerta})"
            motivo = "La alerta subió de nivel por no haber sido atendida a tiempo."
            if mascota:
                # Alerta grave: aviso inmediato al dueño y a la clínica.
                notificar_alerta_grave(db, mascota, motivo, "Alerta sin atender")
            else:
                _notificar_veterinarios(db, nombre_mascota, ROJO, motivo)
            notificadas += 1

    return {"reescaladas": len(subidas), "rojas_notificadas": notificadas}

def enviar_recordatorios_de_citas(db: Session) -> dict:
    """Correo de cita próxima (la de mañana) con lo que le falta a la mascota. Sale una sola
    vez por cita (la marca recordatorio_enviado evita repetirlo en cada ciclo)."""
    from service.citas import CitaService  # import local: citas.py también usa este módulo
    try:
        return CitaService(db).enviar_recordatorios_pendientes(1)
    except Exception as exc:  # un fallo de correo no debe frenar el resto del ciclo
        return {"error": str(exc)}
    
# ── Orquestador: un solo punto de entrada para el scheduler y para el
#    endpoint manual de disparo (útil para demos) ───────────────────────────
def ejecutar_ciclo(db: Session) -> dict:
    resultado = {
        "envios": enviar_preguntas_programadas(db),
        "reintentos": procesar_reintentos_y_vencimiento(db),
        "reescalado": reescalar_y_notificar(db),
        "recordatorios": enviar_recordatorios_de_citas(db),
        "ejecutado_en": _ahora().isoformat(),
    }
    return resultado
