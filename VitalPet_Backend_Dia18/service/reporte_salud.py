from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from models.mascota import Mascota
from service.alerta_grave import notificar_alerta_grave
from models.reporte_salud import ReporteSalud
from schemas.reporte_salud import ReporteSaludCreate
from core.triaje import ROJO, NARANJA, AMARILLO, VERDE, AZUL


class ReporteSaludService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def clasificar(alimentacion: str, actividad: str, sintomas: str) -> str:
        a = alimentacion.strip().lower()
        act = actividad.strip().lower()
        s = sintomas.strip().lower()

        if a == "no comió" and act == "sin energía":
            return ROJO
        if act == "decaída" or s in {"vómito", "diarrea"}:
            return NARANJA
        if a == "poco" or s == "otro":
            return AMARILLO
        # Todo normal: no genera alerta
        if a == "sí, normal" and act == "normal" and s == "ninguno":
            return AZUL
        # Cualquier otro cambio leve (tos, muy activa, valor no reconocido)
        return VERDE

    def _enriquecer(self, reporte):
        if reporte and reporte.mascota:
            reporte.__dict__["nombre_mascota"] = reporte.mascota.nombre_mascota
        return reporte

    def _mascota_propia(self, idMascota: int, idUsuario: int):
        mascota = self.db.query(Mascota).filter(Mascota.idMascota == idMascota).first()
        if not mascota:
            raise HTTPException(status_code=404, detail="La mascota no existe.")
        if mascota.estado == "inactivo":
            raise HTTPException(status_code=400, detail="No se puede reportar una mascota inactiva.")
        if mascota.idUsuario != idUsuario:
            raise HTTPException(status_code=403, detail="No puedes reportar una mascota que no te pertenece.")
        return mascota

    def crear(self, data: ReporteSaludCreate, idUsuario: int):
        mascota = self._mascota_propia(data.idMascota, idUsuario)
        reporte = ReporteSalud(
            idMascota=mascota.idMascota,
            idUsuario=idUsuario,
            alimentacion=data.alimentacion,
            actividad=data.actividad,
            sintomas=data.sintomas,
            observaciones=data.observaciones,
            nivel=self.clasificar(data.alimentacion, data.actividad, data.sintomas),
            revisado=False,
        )
        self.db.add(reporte)
        self.db.commit()
        self.db.refresh(reporte)
        # Alerta grave: aviso inmediato al dueño y a la clínica.
        if reporte.nivel == ROJO:
            notificar_alerta_grave(
                self.db, mascota,
                f"Reporte de salud: alimentación «{data.alimentacion}», actividad «{data.actividad}», síntomas «{data.sintomas}».",
                "Reporte de salud enviado por el dueño",
            )
        return self._enriquecer(reporte)

    def mios(self, idUsuario: int):
        reportes = (
            self.db.query(ReporteSalud)
            .options(joinedload(ReporteSalud.mascota))
            .filter(ReporteSalud.idUsuario == idUsuario)
            .order_by(ReporteSalud.fecha.desc())
            .all()
        )
        return [self._enriquecer(r) for r in reportes]

    def pendientes(self):
        reportes = (
            self.db.query(ReporteSalud)
            .options(joinedload(ReporteSalud.mascota))
            .filter(ReporteSalud.revisado == False)
            .filter(ReporteSalud.nivel != AZUL)  # azul = todo normal, no es alerta
            .order_by(ReporteSalud.fecha.desc())
            .all()
            
        )
        return [self._enriquecer(r) for r in reportes]

    def revisar(self, idReporte: int):
        reporte = self.db.query(ReporteSalud).filter(ReporteSalud.idReporte == idReporte).first()
        if not reporte:
            raise HTTPException(status_code=404, detail="Reporte no encontrado.")
        reporte.revisado = True
        self.db.commit()
        self.db.refresh(reporte)
        return self._enriquecer(reporte)
