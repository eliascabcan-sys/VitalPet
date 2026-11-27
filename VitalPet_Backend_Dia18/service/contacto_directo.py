"""
Día 12 · P2: contacto directo.

Cuando el dueño responde algo MUY MALO en un seguimiento (nivel rojo) ya salen los
correos de alerta grave. Aquí queda la parte humana: una lista de alertas rojas que
nadie ha contactado todavía (con el teléfono del dueño y, si lo tiene, de su
acudiente) y el registro de quién llamó, cuándo y qué se habló.

"Pendiente de contacto" = alerta de nivel rojo sin fecha_contacto. No hace falta
ninguna marca extra al responder: se calcula con lo que ya existe.
"""
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from core.triaje import ROJO
from models.acudiente import Acudiente
from models.alerta_seguimiento import AlertaSeguimiento
from models.historial import HistorialClinico
from models.respuesta_seguimiento import RespuestaSeguimiento
from models.seguimiento import Seguimiento
from models.user import User
from schemas.contacto_directo import ContactoRegistrar
from service.autorizacion import AutorizacionService


def _ahora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ContactoDirectoService:
    def __init__(self, db: Session):
        self.db = db

    def _acudiente_de(self, idUsuario: int) -> dict | None:
        vigente = AutorizacionService(self.db).consentimiento_vigente(idUsuario)
        if not vigente:
            return None
        a = self.db.query(Acudiente).filter(
            Acudiente.idAcudiente == vigente.idAcudiente, Acudiente.estado == "activo",
        ).first()
        return dict(nombre=f"{a.nombre} {a.apellido}".strip(), telefono=a.telefono, parentesco=a.parentesco) if a else None

    def pendientes(self) -> list[dict]:
        alertas = (
            self.db.query(AlertaSeguimiento)
            .options(
                joinedload(AlertaSeguimiento.respuesta).joinedload(RespuestaSeguimiento.pregunta),
                joinedload(AlertaSeguimiento.seguimiento).joinedload(Seguimiento.historial)
                .joinedload(HistorialClinico.mascota),
            )
            .filter(AlertaSeguimiento.nivel == ROJO, AlertaSeguimiento.fecha_contacto.is_(None))
            .order_by(AlertaSeguimiento.fecha_generada.asc())   # la más antigua primero
            .all()
        )
        ahora = _ahora()
        salida = []
        for a in alertas:
            mascota = a.seguimiento.historial.mascota if a.seguimiento and a.seguimiento.historial else None
            dueno = mascota.dueno if mascota else None
            espera = int((ahora - a.fecha_generada).total_seconds() // 60) if a.fecha_generada else 0
            salida.append(dict(
                idAlerta=a.idAlerta, idSeguimiento=a.idSeguimiento,
                idMascota=mascota.idMascota if mascota else None,
                nombre_mascota=mascota.nombre_mascota if mascota else None,
                idDueno=dueno.idUsuario if dueno else None,
                nombre_dueno=f"{dueno.nombre} {dueno.apellido or ''}".strip() if dueno else None,
                telefono_dueno=dueno.telefono if dueno else None,
                email_dueno=dueno.email if dueno else None,
                acudiente=self._acudiente_de(dueno.idUsuario) if dueno else None,
                pregunta=a.respuesta.pregunta.texto_pregunta if a.respuesta and a.respuesta.pregunta else None,
                respuesta=a.respuesta.respuesta if a.respuesta else None,
                fecha_generada=a.fecha_generada, minutos_espera=max(espera, 0),
            ))
        return salida

    def registrar(self, idAlerta: int, usuario: User, datos: ContactoRegistrar) -> AlertaSeguimiento:
        alerta = self.db.query(AlertaSeguimiento).filter(AlertaSeguimiento.idAlerta == idAlerta).first()
        if not alerta:
            raise HTTPException(status_code=404, detail=f"La alerta con id {idAlerta} no existe.")
        if alerta.nivel != ROJO:
            raise HTTPException(status_code=400, detail="Solo las alertas graves (rojas) requieren contacto directo.")
        if alerta.fecha_contacto is not None:
            raise HTTPException(status_code=409, detail="Esta alerta ya tiene un contacto registrado.")

        alerta.fecha_contacto = _ahora()
        alerta.contactado_por = usuario.idUsuario
        alerta.canal_contacto = datos.canal
        alerta.nota_contacto = datos.nota
        # Ya la atendió una persona: deja de reescalarse.
        alerta.notificado_veterinario = True
        if alerta.estado == "pendiente":
            alerta.estado = "vista"
        self.db.commit()
        self.db.refresh(alerta)
        return alerta