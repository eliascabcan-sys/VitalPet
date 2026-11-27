from datetime import date, datetime, time

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload
from models.cita import Cita
from models.historial import HistorialClinico
from models.mascota import Mascota
from schemas.historial import HistorialCreate, HistorialUpdate, SeccionIn
from schemas.seguimiento import SeguimientoCreate
from service.seguimiento import PlantillaService, SeguimientoService
from models.seguimiento import Seguimiento
from models.historial_seccion import HistorialSeccion, SECCIONES_DIAGNOSTICO, TIPOS_SECCION
from service.formula import FormulaService

# Columnas de historial_clinico que cuentan como "diagnóstico" (ver también
# SECCIONES_DIAGNOSTICO en models/historial_seccion.py).
CAMPOS_DIAGNOSTICO = ("diagnostico",)

MSG_MASCOTA_NUEVA = (
    "Esta mascota es nueva (aún no tiene una consulta registrada): en la primera "
    "consulta solo se registra la anamnesis y el examen. El diagnóstico se habilita "
    "desde el siguiente control."
)


class HistorialService:
    def __init__(self, db: Session):
        self.db = db

    def _enriquecer(self, h: HistorialClinico, con_mascota_nueva: bool = False):
        """Agrega datos básicos de la mascota a la respuesta."""
        if h and con_mascota_nueva:
            h.__dict__["mascota_nueva"] = self.es_mascota_nueva(h.idMascota, h.idHistorial)
        if h and h.mascota:
            h.__dict__["nombre_mascota"] = h.mascota.nombre_mascota
            h.__dict__["especie"]        = h.mascota.especie
            h.__dict__["raza"]           = h.mascota.raza
            # Identificador inequívoco del dueño de la mascota.
            h.__dict__["idDueno"] = h.mascota.idUsuario

            # Si ya existe un seguimiento para este historial, lo exponemos
            # para que frontend/admin puedan saber exactamente qué registro
            # clínico originó las preguntas.
            seguimiento = self.db.query(Seguimiento).filter(
                Seguimiento.idHistorial == h.idHistorial,
                Seguimiento.estado != "cancelado"
            ).order_by(Seguimiento.idSeguimiento.desc()).first()
            h.__dict__["idSeguimiento"] = seguimiento.idSeguimiento if seguimiento else None
            h.__dict__["seguimiento_creado"] = seguimiento is not None

            # La fórmula muestra la cita de control (la próxima cita agendada de la mascota).
            if any(f.estado != "anulada" for f in h.formulas):
                h.__dict__["cita_control"] = self._cita_control(h.idMascota)
        return h

    def _cita_control(self, idMascota: int) -> dict | None:
        """
        Próxima cita viva (pendiente o confirmada) de la mascota. Una cita por franja se guarda a
        la hora de inicio de la franja, por eso se cuenta desde el comienzo del día de hoy.
        """
        c = (
            self.db.query(Cita)
            .options(joinedload(Cita.franja), joinedload(Cita.veterinario))
            .filter(
                Cita.idMascota == idMascota,
                Cita.estado.in_(["pendiente", "confirmada"]),
                Cita.fechaHora >= datetime.combine(date.today(), time.min),
            )
            .order_by(Cita.fechaHora.asc())
            .first()
        )
        if not c:
            return None
        vet = c.veterinario.usuario if c.veterinario else None
        return {
            "idCita": c.idCita, "fechaHora": c.fechaHora, "estado": c.estado, "motivo": c.motivo,
            "idFranja": c.idFranja,
            "franja_nombre": c.franja.nombre if c.franja else None,
            "hora_inicio": c.franja.hora_inicio if c.franja else None,
            "hora_fin": c.franja.hora_fin if c.franja else None,
            "nombre_veterinario": f"{vet.nombre} {vet.apellido or ''}".strip() if vet else None,
        }

    def _verificar_mascota(self, idMascota: int):
        mascota = self.db.query(Mascota).filter(
            Mascota.idMascota == idMascota
        ).first()
        if not mascota:
            raise HTTPException(
                status_code=404,
                detail=f"La mascota con id {idMascota} no existe en el sistema."
            )
        if mascota.estado == "inactivo":
            raise HTTPException(
                status_code=404,
                detail=f"La mascota con id {idMascota} fue eliminada. No se puede crear historial para ella."
            )
        return mascota

    def get_all(self):
        historiales = self.db.query(HistorialClinico).filter(
            HistorialClinico.estado == "activo"
        ).order_by(HistorialClinico.fechaRegistro.desc()).all()
        return [self._enriquecer(h) for h in historiales]

    def get_by_id(self, id: int):
        h = self.db.query(HistorialClinico).filter(
            HistorialClinico.idHistorial == id
        ).first()
        if not h:
            raise HTTPException(
                status_code=404,
                detail=f"El historial con id {id} no existe en el sistema."
            )
        if h.estado == "inactivo":
            raise HTTPException(
                status_code=404,
                detail=f"El historial con id {id} no se puede modificar porque fue eliminado."
            )
        return self._enriquecer(h, con_mascota_nueva=True)

    def get_by_mascota(self, mascota_id: int):
        self._verificar_mascota(mascota_id)
        historiales = self.db.query(HistorialClinico).filter(
            HistorialClinico.idMascota == mascota_id,
            HistorialClinico.estado == "activo"
        ).order_by(HistorialClinico.fechaRegistro.desc()).all()
        return [self._enriquecer(h) for h in historiales]

    def get_by_usuario(self, usuario_id: int):
        """Historiales creados por un veterinario específico."""
        historiales = self.db.query(HistorialClinico).filter(
            HistorialClinico.idUsuario == usuario_id,
            HistorialClinico.estado == "activo"
        ).order_by(HistorialClinico.fechaRegistro.desc()).all()
        return [self._enriquecer(h) for h in historiales]

    def get_by_usuario_dueno(self, usuario_id: int):
        """Todos los historiales de las mascotas de un dueño."""
        historiales = (
            self.db.query(HistorialClinico)
            .join(Mascota, HistorialClinico.idMascota == Mascota.idMascota)
            .filter(
                Mascota.idUsuario == usuario_id,
                HistorialClinico.estado == "activo",
            )
            .order_by(HistorialClinico.fechaRegistro.desc())
            .all()
        )
        return [self._enriquecer(h) for h in historiales]

    # ------------------------------------------------------------------
    # Regla de "mascota nueva": solo anamnesis y examen, sin diagnóstico
    # ------------------------------------------------------------------
    def _consultas_previas(self, idMascota: int, antes_de: int | None = None) -> int:
        """
        Cuenta las consultas REALES anteriores de la mascota. Al registrar una
        mascota el sistema crea un historial vacío automático (RQF-12); ese no
        cuenta como consulta, por eso se exige que tenga algún dato clínico:
        motivo, diagnóstico, tratamiento, peso, temperatura, alguna sección o fórmula.
        """
        tiene = lambda col: and_(col.isnot(None), col != "")
        real = or_(
            tiene(HistorialClinico.motivo_consulta),
            tiene(HistorialClinico.diagnostico),
            tiene(HistorialClinico.tratamiento),
            HistorialClinico.peso_consulta.isnot(None),
            HistorialClinico.temperatura.isnot(None),
            HistorialClinico.secciones.any(),
            HistorialClinico.formulas.any(),
        )
        q = self.db.query(HistorialClinico).filter(
            HistorialClinico.idMascota == idMascota,
            HistorialClinico.estado == "activo",
            real,
        )
        if antes_de is not None:
            q = q.filter(HistorialClinico.idHistorial < antes_de)
        return q.count()

    def es_mascota_nueva(self, idMascota: int, idHistorial: int | None = None) -> bool:
        """
        True si, para este registro, la mascota todavía no tiene una consulta
        real anterior. Al crear un registro (idHistorial=None) se miran todas
        las consultas; al editar uno existente, solo las anteriores a él, así
        la primera consulta sigue siendo "de mascota nueva" aunque se edite.
        """
        return self._consultas_previas(idMascota, idHistorial) == 0

    def estado_clinico_mascota(self, idMascota: int) -> dict:
        self._verificar_mascota(idMascota)
        previas = self._consultas_previas(idMascota)
        nueva = previas == 0
        return {
            "idMascota": idMascota,
            "mascota_nueva": nueva,
            "consultas_previas": previas,
            "campos_bloqueados": list(CAMPOS_DIAGNOSTICO) if nueva else [],
            "secciones_bloqueadas": list(SECCIONES_DIAGNOSTICO) if nueva else [],
        }

    def _validar_sin_diagnostico(self, nueva: bool, diagnostico, diagnostico_actual, secciones, secciones_actuales):
        """
        Si la mascota es nueva, rechaza cualquier diagnóstico NUEVO. Solo se
        bloquea lo que cambia respecto a lo ya guardado, para no impedir
        editar registros antiguos que ya traían un diagnóstico.
        """
        if not nueva:
            return
        norm = lambda v: (v or "").strip()
        if norm(diagnostico) and norm(diagnostico) != norm(diagnostico_actual):
            raise HTTPException(status_code=400, detail=MSG_MASCOTA_NUEVA)
        for sec in secciones or []:
            if sec.tipo in SECCIONES_DIAGNOSTICO and norm(sec.contenido) \
                    and norm(sec.contenido) != norm(secciones_actuales.get(sec.tipo)):
                raise HTTPException(status_code=400, detail=MSG_MASCOTA_NUEVA)

    # ------------------------------------------------------------------
    # Peso en cada control
    # ------------------------------------------------------------------
    def _sincronizar_peso_mascota(self, h: HistorialClinico):
        """El peso de la mascota es el del último control que tenga peso."""
        if h.peso_consulta is None:
            return
        hay_posterior = self.db.query(HistorialClinico.idHistorial).filter(
            HistorialClinico.idMascota == h.idMascota,
            HistorialClinico.estado == "activo",
            HistorialClinico.idHistorial > h.idHistorial,
            HistorialClinico.peso_consulta.isnot(None),
        ).first()
        if not hay_posterior and h.mascota:
            h.mascota.peso_kg = h.peso_consulta

    def pesos_por_mascota(self, idMascota: int):
        """Peso registrado en cada control, del más antiguo al más reciente."""
        self._verificar_mascota(idMascota)
        controles = self.db.query(HistorialClinico).filter(
            HistorialClinico.idMascota == idMascota,
            HistorialClinico.estado == "activo",
            HistorialClinico.peso_consulta.isnot(None),
        ).order_by(HistorialClinico.fechaRegistro.asc(), HistorialClinico.idHistorial.asc()).all()
        return [
            {"idHistorial": h.idHistorial, "fecha": h.fechaRegistro, "peso_kg": h.peso_consulta}
            for h in controles
        ]

    # ------------------------------------------------------------------
    # Secciones de la hoja
    # ------------------------------------------------------------------
    def _aplicar_secciones(self, db_h: HistorialClinico, secciones: list[SeccionIn]):
        """Crea/actualiza/borra (si viene vacía) cada sección. NO hace commit."""
        existentes = {s.tipo: s for s in db_h.secciones}
        por_tipo = {s.tipo: s for s in secciones}  # si un tipo viene repetido, gana el último

        for tipo, s in por_tipo.items():
            texto = (s.contenido or "").strip()
            actual = existentes.get(tipo)
            if not texto:
                if actual:
                    self.db.delete(actual)
                continue
            if actual:
                actual.contenido = texto
            else:
                self.db.add(HistorialSeccion(
                    idHistorial=db_h.idHistorial,
                    tipo=tipo,
                    contenido=texto,
                    orden=TIPOS_SECCION.index(tipo) + 1,
                ))

    def _activar_seguimiento_si_corresponde(self, historial: HistorialClinico, mascota: Mascota):
        """Activa automáticamente el seguimiento asociado al diagnóstico.

        La relación queda siempre anclada al historial -> mascota -> dueño,
        por lo que una pregunta nunca queda sin destinatario. Si no existe
        plantilla compatible, el historial sigue siendo válido y no falla.
        """
        if not historial.diagnostico:
            return None

        plantilla = PlantillaService(self.db).buscar_por_animal_diagnostico(
            mascota.especie, historial.diagnostico
        )
        if not plantilla:
            return None

        return SeguimientoService(self.db).iniciar(
            SeguimientoCreate(
                idHistorial=historial.idHistorial,
                idPlantilla=plantilla.idPlantilla,
            )
        )

    def create(self, data: HistorialCreate):
        mascota = self._verificar_mascota(data.idMascota)

        # Peso en cada control: toda consulta registra el peso de la mascota.
        if data.peso_consulta is None:
            raise HTTPException(
                status_code=400,
                detail="Registra el peso de la mascota (kg) en este control.",
            )

        nueva = self.es_mascota_nueva(data.idMascota)
        self._validar_sin_diagnostico(nueva, data.diagnostico, None, data.secciones, {})

        db_h = HistorialClinico(**data.model_dump(exclude={"secciones", "formula"}))
        self.db.add(db_h)
        self.db.flush()  # para tener idHistorial antes de guardar las secciones
        self._aplicar_secciones(db_h, data.secciones)
        if data.formula:
            FormulaService(self.db).guardar_para_historial_sin_commit(db_h, data.formula)
        self._sincronizar_peso_mascota(db_h)
        self.db.commit()
        self.db.refresh(db_h)

        seguimiento = self._activar_seguimiento_si_corresponde(db_h, mascota)
        db_h.__dict__["seguimiento_creado"] = seguimiento is not None
        db_h.__dict__["idSeguimiento"] = seguimiento.idSeguimiento if seguimiento else None
        return self._enriquecer(db_h, con_mascota_nueva=True)

    def update(self, id: int, data: HistorialUpdate):
        db_h = self.get_by_id(id)
        cambios = data.model_dump(exclude_unset=True, exclude={"secciones", "formula"})

        # El peso de un control ya registrado no se puede borrar.
        if "peso_consulta" in cambios and cambios["peso_consulta"] is None and db_h.peso_consulta is not None:
            raise HTTPException(status_code=400, detail="El peso de cada control es obligatorio.")

        nueva = self.es_mascota_nueva(db_h.idMascota, db_h.idHistorial)
        self._validar_sin_diagnostico(
            nueva,
            cambios.get("diagnostico"), db_h.diagnostico,
            data.secciones, {s.tipo: s.contenido for s in db_h.secciones},
        )

        for key, value in cambios.items():
            setattr(db_h, key, value)
        if data.secciones is not None:
            self._aplicar_secciones(db_h, data.secciones)
        if data.formula is not None:
            FormulaService(self.db).guardar_para_historial_sin_commit(db_h, data.formula)
        self._sincronizar_peso_mascota(db_h)
        self.db.commit()
        self.db.refresh(db_h)

        # Si el diagnóstico se agregó o modificó, intenta activar el
        # seguimiento. SeguimientoService evita duplicar el mismo par
        # historial/plantilla cuando ya existe uno en curso.
        seguimiento = None
        if "diagnostico" in cambios and db_h.diagnostico:
            seguimiento = self._activar_seguimiento_si_corresponde(db_h, db_h.mascota)

        resultado = self._enriquecer(db_h, con_mascota_nueva=True)
        if seguimiento is not None:
            resultado.__dict__["seguimiento_creado"] = True
            resultado.__dict__["idSeguimiento"] = seguimiento.idSeguimiento
        return resultado

    def guardar_secciones(self, id: int, secciones: list[SeccionIn]):
        """Crea, actualiza o borra (si viene vacía) cada sección de la hoja."""
        db_h = self.get_by_id(id)
        nueva = self.es_mascota_nueva(db_h.idMascota, db_h.idHistorial)
        self._validar_sin_diagnostico(nueva, None, None, secciones, {s.tipo: s.contenido for s in db_h.secciones})
        self._aplicar_secciones(db_h, secciones)
        self.db.commit()
        self.db.refresh(db_h)
        return self._enriquecer(db_h, con_mascota_nueva=True)

    def soft_delete(self, id: int):
        db_h = self.get_by_id(id)
        db_h.estado = "inactivo"
        self.db.commit()
        return True