"""Consulta a la BD lo que le falta a una mascota antes de su cita (vacunas, exámenes)."""
from datetime import date, datetime, time

from sqlalchemy.orm import Session

from core.pendientes_cita import ESTADOS_EXAMEN_PENDIENTE, armar_pendientes
from models.cita import Cita
from models.laboratorio import ExamenLaboratorio
from models.mascota import Mascota
from models.user import User
from service.esquema_sanitario import EsquemaSanitarioService


def pendientes_de_mascota(db: Session, mascota: Mascota, hoy: date | None = None) -> dict:
    esquema = EsquemaSanitarioService(db).de_mascota(mascota, hoy)
    examenes = (
        db.query(ExamenLaboratorio)
        .filter(
            ExamenLaboratorio.idMascota == mascota.idMascota,
            ExamenLaboratorio.estado.in_(ESTADOS_EXAMEN_PENDIENTE),
        )
        .order_by(ExamenLaboratorio.fecha_solicitud.asc())
        .all()
    )
    return armar_pendientes(
        esquema["items"],
        [{"tipo_examen": e.tipo_examen, "estado": e.estado} for e in examenes],
    )


def preparacion_de_citas_del_dueno(db: Session, usuario: User, hoy: date | None = None) -> list[dict]:
    """Una fila por cita próxima del dueño, con lo que le falta a la mascota. Se usa en 'Mis citas'."""
    hoy = hoy or date.today()
    citas = (
        db.query(Cita)
        .filter(
            Cita.idUsuario == usuario.idUsuario,
            Cita.estado.in_(("pendiente", "confirmada")),
            Cita.fechaHora >= datetime.combine(hoy, time.min),
        )
        .order_by(Cita.fechaHora.asc())
        .all()
    )
    por_mascota: dict[int, dict] = {}  # se calcula una vez por mascota aunque tenga varias citas
    filas = []
    for c in citas:
        if c.idMascota not in por_mascota:
            por_mascota[c.idMascota] = pendientes_de_mascota(db, c.mascota, hoy)
        filas.append({
            "idCita": c.idCita,
            "idMascota": c.idMascota,
            "nombre_mascota": c.mascota.nombre_mascota,
            "fechaHora": c.fechaHora,
            **por_mascota[c.idMascota],
        })
    return filas