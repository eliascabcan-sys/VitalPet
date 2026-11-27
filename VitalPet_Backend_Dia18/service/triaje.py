from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from core.triaje import ROJO, obtener_nivel, subir_nivel
from models.alerta_seguimiento import AlertaSeguimiento


def _ahora_utc() -> datetime:
    # Misma convencion que el resto del backend: UTC sin tzinfo
    return datetime.now(timezone.utc).replace(tzinfo=None)


def reescalar_alertas(db: Session, ahora: Optional[datetime] = None) -> list[AlertaSeguimiento]:
    """
    Sube UN nivel a cada alerta que el veterinario todavia no vio
    (notificado_veterinario = False) y que ya paso el tiempo objetivo de su
    nivel actual. Al subir, el tiempo vuelve a contar desde cero con el nuevo
    nivel, asi que una alerta sube como maximo un nivel por llamada.

    - Rojo no sube mas.
    - Las alertas ya vistas no se tocan.
    - `ahora` solo se pasa en las pruebas; en produccion se deja en None.

    Devuelve la lista de alertas que subieron (P4 la puede usar para notificar).
    """
    ahora = ahora or _ahora_utc()

    pendientes = db.query(AlertaSeguimiento).filter(
        AlertaSeguimiento.notificado_veterinario == False  # noqa: E712
    ).all()

    subidas = []
    for alerta in pendientes:
        nivel = obtener_nivel(alerta.nivel)
        if nivel is None or nivel.codigo == ROJO:
            continue

        # Desde cuando corre el tiempo del nivel actual
        desde = alerta.fecha_nivel or alerta.fecha_generada
        if desde is None:
            continue

        if ahora - desde > timedelta(minutes=nivel.minutos_objetivo):
            if alerta.nivel_original is None:
                alerta.nivel_original = alerta.nivel
            alerta.nivel = subir_nivel(nivel.codigo)
            alerta.fecha_nivel = ahora
            alerta.veces_reescalada = (alerta.veces_reescalada or 0) + 1
            subidas.append(alerta)

    if subidas:
        db.commit()
    return subidas