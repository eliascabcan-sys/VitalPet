from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import case, or_

from models.historial import HistorialClinico
from models.laboratorio import ExamenLaboratorio
from models.mascota import Mascota
from models.user import User
from schemas.laboratorio import ExamenCreate, ExamenUpdate

# Estados a los que se puede pasar desde cada uno (el flujo solo avanza).
TRANSICIONES = {
    "solicitado": {"solicitado", "en_proceso", "entregado", "cancelado"},
    "en_proceso": {"en_proceso", "entregado", "cancelado"},
    "entregado":  {"entregado"},
    "cancelado":  {"cancelado"},
}


class LaboratorioService:
    def __init__(self, db: Session):
        self.db = db

    # ---------- utilidades ----------
    def _enriquecer(self, e: ExamenLaboratorio, para_dueno: bool = False) -> ExamenLaboratorio:
        e.__dict__["nombre_mascota"] = e.mascota.nombre_mascota if e.mascota else None
        # El dueño solo ve el resultado cuando el laboratorio ya lo entregó.
        if para_dueno and e.estado != "entregado":
            e.__dict__["resultado"] = None
            e.__dict__["valores"] = None
            e.__dict__["archivo_url"] = None
        return e

    def _consulta(self):
        return self.db.query(ExamenLaboratorio).options(joinedload(ExamenLaboratorio.mascota))

    def _verificar_historial(self, idHistorial: int) -> HistorialClinico:
        h = self.db.query(HistorialClinico).filter(HistorialClinico.idHistorial == idHistorial).first()
        if not h or h.estado == "inactivo":
            raise HTTPException(status_code=404, detail=f"El historial con id {idHistorial} no existe en el sistema.")
        return h

    def get_by_id(self, idExamen: int) -> ExamenLaboratorio:
        e = self._consulta().filter(ExamenLaboratorio.idExamen == idExamen).first()
        if not e:
            raise HTTPException(status_code=404, detail=f"El examen con id {idExamen} no existe en el sistema.")
        return e

    @staticmethod
    def _es_dueno(usuario: User) -> bool:
        return usuario.rol == "dueno"

    def verificar_acceso(self, e: ExamenLaboratorio, usuario: User):
        if self._es_dueno(usuario) and (not e.mascota or e.mascota.idUsuario != usuario.idUsuario):
            raise HTTPException(status_code=403, detail="No puedes consultar un examen que no pertenece a tu mascota.")

    # ---------- consultas ----------
    def _listar(self, filtro, usuario: User):
        q = self._consulta().filter(filtro)
        dueno = self._es_dueno(usuario)
        if dueno:
            q = q.filter(ExamenLaboratorio.estado != "cancelado")
        items = q.order_by(ExamenLaboratorio.fecha_solicitud.desc(), ExamenLaboratorio.idExamen.desc()).all()
        return [self._enriquecer(e, dueno) for e in items]
    def listar_todos(self, estado: str | None = None, buscar: str | None = None, limite: int = 300):
        """Todos los exámenes de todos los pacientes (pantalla del laboratorio del veterinario).
        Primero los pendientes (el que lleva más tiempo esperando, arriba) y luego los demás, del más nuevo al más viejo."""
        q = (
            self.db.query(ExamenLaboratorio)
            .options(joinedload(ExamenLaboratorio.mascota).joinedload(Mascota.dueno))
            .join(Mascota, ExamenLaboratorio.idMascota == Mascota.idMascota)
            .join(User, Mascota.idUsuario == User.idUsuario)
        )
        if estado:
            q = q.filter(ExamenLaboratorio.estado == estado)
        else:
            q = q.filter(ExamenLaboratorio.estado != "cancelado")   # los cancelados solo si se piden
        if buscar and buscar.strip():
            patron = f"%{buscar.strip()}%"
            q = q.filter(or_(
                ExamenLaboratorio.tipo_examen.ilike(patron), Mascota.nombre_mascota.ilike(patron),
                User.nombre.ilike(patron), User.apellido.ilike(patron),
            ))

        pendiente = ExamenLaboratorio.estado.in_(("solicitado", "en_proceso"))
        items = q.order_by(
            case((pendiente, 0), else_=1),
            case((pendiente, ExamenLaboratorio.fecha_solicitud)).asc(),
            case((pendiente, None), else_=ExamenLaboratorio.fecha_solicitud).desc(),
            ExamenLaboratorio.idExamen.desc(),
        ).limit(limite).all()

        for e in items:
            self._enriquecer(e)
            d = e.mascota.dueno if e.mascota else None
            e.__dict__["nombre_dueno"] = f"{d.nombre} {d.apellido or ''}".strip() if d else None
            e.__dict__["especie"] = e.mascota.especie if e.mascota else None
        return items
    
    def por_historial(self, idHistorial: int, usuario: User):
        h = self._verificar_historial(idHistorial)
        if self._es_dueno(usuario) and (not h.mascota or h.mascota.idUsuario != usuario.idUsuario):
            raise HTTPException(status_code=403, detail="No puedes consultar exámenes que no pertenecen a tu mascota.")
        return self._listar(ExamenLaboratorio.idHistorial == idHistorial, usuario)

    def por_mascota(self, idMascota: int, usuario: User):
        m = self.db.query(Mascota).filter(Mascota.idMascota == idMascota).first()
        if not m:
            raise HTTPException(status_code=404, detail=f"La mascota con id {idMascota} no existe en el sistema.")
        if self._es_dueno(usuario) and m.idUsuario != usuario.idUsuario:
            raise HTTPException(status_code=403, detail="No puedes consultar exámenes de una mascota que no te pertenece.")
        return self._listar(ExamenLaboratorio.idMascota == idMascota, usuario)

    def del_dueno(self, usuario: User):
        ids = [m.idMascota for m in self.db.query(Mascota).filter(Mascota.idUsuario == usuario.idUsuario).all()]
        if not ids:
            return []
        return self._listar(ExamenLaboratorio.idMascota.in_(ids), usuario)

    def get_visible(self, idExamen: int, usuario: User):
        e = self.get_by_id(idExamen)
        self.verificar_acceso(e, usuario)
        if self._es_dueno(usuario) and e.estado == "cancelado":
            raise HTTPException(status_code=404, detail=f"El examen con id {idExamen} no existe en el sistema.")
        return self._enriquecer(e, self._es_dueno(usuario))

    # ---------- escritura (veterinario / administrador) ----------
    def crear(self, data: ExamenCreate, usuario: User) -> ExamenLaboratorio:
        h = self._verificar_historial(data.idHistorial)
        e = ExamenLaboratorio(
            idHistorial=h.idHistorial, idMascota=h.idMascota, idUsuarioSolicita=usuario.idUsuario,
            categoria=data.categoria, tipo_examen=data.tipo_examen,
            observaciones=data.observaciones, estado="solicitado",
        )
        self.db.add(e)
        self.db.commit()
        return self._enriquecer(self.get_by_id(e.idExamen))

    def actualizar(self, idExamen: int, data: ExamenUpdate) -> ExamenLaboratorio:
        e = self.get_by_id(idExamen)
        if e.estado == "cancelado":
            raise HTTPException(status_code=400, detail="El examen está cancelado y no se puede modificar.")
        cambios = data.model_dump(exclude_unset=True)

        nuevo_estado = cambios.get("estado", e.estado)
        if nuevo_estado not in TRANSICIONES[e.estado]:
            raise HTTPException(status_code=400, detail=f"No se puede pasar un examen de '{e.estado}' a '{nuevo_estado}'.")

        if "valores" in cambios and cambios["valores"] is not None:
            cambios["valores"] = [v if isinstance(v, dict) else v.model_dump() for v in cambios["valores"]]

        resultado = cambios.get("resultado", e.resultado)
        valores = cambios.get("valores", e.valores)
        archivo = cambios.get("archivo_url", e.archivo_url)
        if nuevo_estado == "entregado" and not (resultado or valores or archivo):
            raise HTTPException(
                status_code=400,
                detail="Para entregar el examen registra el resultado, los valores o un enlace al archivo.",
            )

        for k, v in cambios.items():
            setattr(e, k, v)
        if nuevo_estado == "entregado" and not e.fecha_resultado:
            e.fecha_resultado = datetime.now()
        self.db.commit()
        return self._enriquecer(self.get_by_id(idExamen))

    def cancelar(self, idExamen: int) -> bool:
        e = self.get_by_id(idExamen)
        if e.estado == "entregado":
            raise HTTPException(status_code=400, detail="Un examen entregado no se puede cancelar.")
        if e.estado == "cancelado":
            raise HTTPException(status_code=400, detail="El examen ya estaba cancelado.")
        e.estado = "cancelado"
        self.db.commit()
        return True
