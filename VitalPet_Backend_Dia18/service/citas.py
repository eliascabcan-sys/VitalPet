from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import date, datetime, time, timedelta
from sqlalchemy import and_, func, or_
from models.cita import Cita
from models.mascota import Mascota
from models.user import User
from models.derivacion import Derivacion
from models.franja_horaria import FranjaHoraria
from models.veterinario import Veterinario
from schemas.cita import CitaCreate, CitaUpdate
from service.autorizacion import AutorizacionService
from service.pendientes_cita import pendientes_de_mascota


class CitaService:
    DIAS_SEMANA = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
    MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
             "agosto", "septiembre", "octubre", "noviembre", "diciembre")

    def __init__(self, db: Session):
        self.db = db

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
                detail=f"La mascota con id {idMascota} fue eliminada. No se puede agendar una cita para ella."
            )
        return mascota

    def _verificar_usuario(self, idUsuario: int):
        usuario = self.db.query(User).filter(
            User.idUsuario == idUsuario,
            User.estado == "activo"
        ).first()
        if not usuario:
            raise HTTPException(
                status_code=404,
                detail=f"El usuario con id {idUsuario} no existe o está inactivo."
            )
        return usuario

    def _verificar_veterinario(self, idVeterinario: int):
        from models.veterinario import Veterinario
        vet = self.db.query(Veterinario).filter(
            Veterinario.idVeterinario == idVeterinario
        ).first()
        if not vet:
            raise HTTPException(
                status_code=404,
                detail=f"El veterinario con id {idVeterinario} no existe en el sistema."
            )
        if vet.estado == "inactivo":
            raise HTTPException(
                status_code=400,
                detail=f"El veterinario con id {idVeterinario} está inactivo. Asigna otro veterinario."
            )
        return vet

    # ------------------------------------------------------------------
    # Franjas horarias (cita "sin hora exacta": mañana / tarde)
    # ------------------------------------------------------------------
    def _verificar_franja(self, idFranja: int) -> FranjaHoraria:
        franja = self.db.query(FranjaHoraria).filter(FranjaHoraria.idFranja == idFranja).first()
        if not franja or franja.estado != "activo":
            raise HTTPException(
                status_code=404,
                detail=f"La franja horaria con id {idFranja} no existe o no está activa."
            )
        return franja

    def _cupo_total(self, franja: FranjaHoraria, idVeterinario: int | None) -> int:
        """
        Cupo de la franja: cupo_maximo es POR veterinario. Si la cita no tiene
        veterinario asignado, cuenta la capacidad de toda la clínica.
        """
        if idVeterinario:
            return franja.cupo_maximo
        from models.veterinario import Veterinario
        activos = self.db.query(func.count(Veterinario.idVeterinario)).filter(
            Veterinario.estado == "activo"
        ).scalar() or 0
        return franja.cupo_maximo * max(1, activos)

    @staticmethod
    def _cita_en_franja(c: Cita, franja: FranjaHoraria) -> bool:
        """
        True si la cita ocupa un cupo de la franja: o se agendo POR franja, o se agendo
        con hora exacta (idFranja vacio) y su hora cae dentro de la franja. Antes las
        citas con hora exacta no contaban y la agenda mostraba 0/6 aunque hubiera citas.
        """
        if c.idFranja is not None:
            return c.idFranja == franja.idFranja
        return franja.hora_inicio <= c.fechaHora.time() < franja.hora_fin

    def _contar_cupo(self, franja: FranjaHoraria, dia: date, idVeterinario: int | None, excluir_id: int | None = None) -> int:
        """Citas activas del dia que ocupan la franja (por idFranja o por su hora exacta)."""
        q = self.db.query(Cita).filter(
            Cita.estado.in_(["pendiente", "confirmada"]),
            Cita.fechaHora >= datetime.combine(dia, time.min),
            Cita.fechaHora <= datetime.combine(dia, time.max),
        )
        if idVeterinario:
            q = q.filter(Cita.idVeterinario == idVeterinario)
        if excluir_id:
            q = q.filter(Cita.idCita != excluir_id)
        return sum(1 for c in q.all() if self._cita_en_franja(c, franja))

    def _motivo_franja_no_disponible(self, franja: FranjaHoraria, dia: date, idVeterinario: int | None, excluir_id: int | None = None) -> str | None:
        """None si se puede agendar; si no, el motivo en lenguaje claro."""
        ahora = datetime.now()
        if dia < ahora.date():
            return "La fecha ya pasó."
        if dia == ahora.date() and ahora.time() >= franja.hora_inicio:
            return f"La franja de {franja.nombre.lower()} de hoy ya comenzó."
        if self._contar_cupo(franja, dia, idVeterinario, excluir_id) >= self._cupo_total(franja, idVeterinario):
            return "Franja llena."
        return None

    def get_franjas(self):
        return self.db.query(FranjaHoraria).filter(
            FranjaHoraria.estado == "activo"
        ).order_by(FranjaHoraria.hora_inicio.asc()).all()

    def disponibilidad_franjas(self, fecha: date, idVeterinario: int | None = None):
        """Franjas activas con cuántos cupos quedan ese día (para pintar la pantalla del dueño)."""
        if idVeterinario:
            self._verificar_veterinario(idVeterinario)
        resultado = []
        for f in self.get_franjas():
            usados = self._contar_cupo(f, fecha, idVeterinario)
            cupo = self._cupo_total(f, idVeterinario)
            motivo = self._motivo_franja_no_disponible(f, fecha, idVeterinario)
            resultado.append({
                "idFranja": f.idFranja,
                "nombre": f.nombre,
                "hora_inicio": f.hora_inicio,
                "hora_fin": f.hora_fin,
                "cupo_maximo": f.cupo_maximo,
                "cupos_usados": usados,
                "cupos_disponibles": max(cupo - usados, 0),
                "disponible": motivo is None,
                "motivo_no_disponible": motivo,
            })
        return resultado

    # ---- lista del veterinario: citas con nombres (mascota, dueño, veterinario) ----
    def _con_nombres(self, citas):
        for c in citas:
            m, d, v = c.mascota, c.dueno, c.veterinario
            c.nombre_mascota = m.nombre_mascota if m else None
            c.especie = m.especie if m else None
            c.nombre_dueno = f"{d.nombre} {d.apellido or ''}".strip() if d else None
            c.nombre_veterinario = f"{v.usuario.nombre} {v.usuario.apellido or ''}".strip() if v and v.usuario else None
        return citas

    @staticmethod
    def _cargar_nombres():
        # Todo en una sola consulta (sin N+1): mascota, dueño, franja y veterinario con su usuario.
        return (
            joinedload(Cita.mascota),
            joinedload(Cita.dueno),
            joinedload(Cita.franja),
            joinedload(Cita.veterinario).joinedload(Veterinario.usuario),
        )

    def get_all(self):
        citas = (
            self.db.query(Cita)
            .options(*self._cargar_nombres())
            .order_by(Cita.fechaHora.desc())
            .all()
        )
        return self._con_nombres(citas)

    def get_by_id(self, id: int):
        cita = self.db.query(Cita).filter(Cita.idCita == id).first()
        if not cita:
            raise HTTPException(
                status_code=404,
                detail=f"La cita con id {id} no existe en el sistema."
            )
        if cita.estado == "cancelada":
            raise HTTPException(
                status_code=400,
                detail=f"La cita con id {id} no se puede modificar porque fue cancelada."
            )
        return cita

    def get_by_usuario(self, usuario_id: int):
        return self.db.query(Cita).filter(
            Cita.idUsuario == usuario_id
        ).order_by(Cita.fechaHora.desc()).all()

    def get_by_mascota(self, mascota_id: int):
        self._verificar_mascota(mascota_id)
        return self.db.query(Cita).filter(
            Cita.idMascota == mascota_id
        ).order_by(Cita.fechaHora.desc()).all()

    def get_pendientes(self):
        """Citas pendientes ordenadas por fecha más próxima."""
        citas = self.db.query(Cita).options(*self._cargar_nombres()).filter(
            Cita.estado == "pendiente",
            or_(
                Cita.fechaHora >= datetime.now(),
                # Cita por franja: se guarda a la hora de inicio de la franja,
                # pero sigue pendiente durante todo el día.
                and_(Cita.idFranja.isnot(None), Cita.fechaHora >= datetime.combine(date.today(), time.min)),
            )
        ).order_by(Cita.fechaHora.asc()).all()
        return self._con_nombres(citas)

    def get_ocupadas_por_veterinario(self, idVeterinario: int, fecha: date):
        """
        RQF: horas ocupadas de UN veterinario en un día puntual, para que
        el frontend pinte disponibilidad real antes de que el dueño intente
        agendar. Antes esto solo existía por mascota (get_by_mascota), lo
        que no servía para saber si el veterinario ya está copado.
        Solo cuentan citas no canceladas.
        """
        self._verificar_veterinario(idVeterinario)
        inicio = datetime.combine(fecha, datetime.min.time())
        fin = datetime.combine(fecha, datetime.max.time())
        return self.db.query(Cita).filter(
            Cita.idVeterinario == idVeterinario,
            Cita.estado != "cancelada",
            Cita.fechaHora >= inicio,
            Cita.fechaHora <= fin,
        ).order_by(Cita.fechaHora.asc()).all()

    def _es_veterinario_general(self, especialidad: str | None) -> bool:
        """Compara contra 'Medicina general', sin distinguir mayúsculas/minúsculas."""
        if not especialidad:
            return False
        return especialidad.strip().lower() == "medicina general"

    def create(self, data: CitaCreate, rol_usuario_actual: str | None = None):
        mascota = self._verificar_mascota(data.idMascota)
        usuario = self._verificar_usuario(data.idUsuario)

        # Un dueño solo puede agendar para una mascota propia. El endpoint
        # ya fuerza idUsuario al usuario autenticado, pero esta comprobación
        # protege también la capa de servicio.
        if rol_usuario_actual == "dueno" and mascota.idUsuario != usuario.idUsuario:
            raise HTTPException(
                status_code=403,
                detail="No puedes agendar una cita para una mascota que no te pertenece."
            )
        
        AutorizacionService(self.db).exigir_para_cita(usuario)

        vet = None
        derivacion = None
        if data.idVeterinario:
            vet = self._verificar_veterinario(data.idVeterinario)

            # Punto 3: el dueño solo puede agendar directamente con veterinario general.
            if rol_usuario_actual == "dueno" and not self._es_veterinario_general(vet.especialidad):
                # Punto 5: si es especialista, exige una derivacion pendiente
                # para esa mascota/especialidad (el general la autorizo).
                derivacion = self.db.query(Derivacion).filter(
                    Derivacion.idMascota == data.idMascota,
                    Derivacion.especialidadDestino == vet.especialidad,
                    Derivacion.estado == "pendiente",
                ).first()
                if not derivacion:
                    raise HTTPException(
                        status_code=403,
                        detail=(
                            "Como dueño solo puedes agendar directamente con un veterinario general. "
                            "Para agendar con un especialista, primero necesitas una derivación activa "
                            "del veterinario general hacia esa especialidad."
                        )
                    )

        # --- Fecha y hora de la cita ----------------------------------------
        # Por franja (dueño): se valida el cupo y se guarda la hora de inicio
        # de la franja. Con hora exacta (personal): se valida el cruce de 30 min.
        if data.idFranja is not None:
            franja = self._verificar_franja(data.idFranja)
            dia = data.fecha or data.fechaHora.date()
            motivo_no = self._motivo_franja_no_disponible(franja, dia, data.idVeterinario)
            if motivo_no:
                raise HTTPException(
                    status_code=400,
                    detail=f"No se puede agendar en la franja de {franja.nombre.lower()}: {motivo_no} Elige otra franja u otro día."
                )
            fecha_hora = datetime.combine(dia, franja.hora_inicio)
        else:
            fecha_hora = data.fechaHora
            # Verificar que el VETERINARIO no tenga otra cita pendiente
            # en la misma franja horaria (margen de 30 minutos). El bug anterior
            # comparaba idMascota, lo que permitía agendar al mismo
            # veterinario con dos mascotas distintas a la misma hora.
            inicio = fecha_hora - timedelta(minutes=30)
            fin    = fecha_hora + timedelta(minutes=30)

            if data.idVeterinario:
                conflicto = self.db.query(Cita).filter(
                    Cita.idVeterinario == data.idVeterinario,
                    Cita.estado.in_(["pendiente", "confirmada"]),
                    Cita.fechaHora > inicio,
                    Cita.fechaHora < fin
                ).first()

                if conflicto:
                    raise HTTPException(
                        status_code=400,
                        detail=f"El veterinario ya tiene una cita pendiente en esa franja horaria."
                    )

        datos = data.model_dump(exclude={"fecha"})
        datos["fechaHora"] = fecha_hora
        db_cita = Cita(**datos)
        self.db.add(db_cita)

        # La derivacion se marca "agendada" para que no se reutilice en otra cita.
        if derivacion:
            derivacion.estado = "agendada"

        self.db.commit()
        self.db.refresh(db_cita)
        return db_cita

    def derivar_caso(self, idHistorialOrigen: int, idMascota: int, idVeterinarioOrigen: int, especialidadDestino: str):
        """Punto 5: el veterinario general crea una derivacion hacia un especialista."""
        derivacion = Derivacion(
            idHistorialOrigen=idHistorialOrigen,
            idMascota=idMascota,
            idVeterinarioOrigen=idVeterinarioOrigen,
            especialidadDestino=especialidadDestino,
            estado="pendiente",
        )
        self.db.add(derivacion)
        self.db.commit()
        self.db.refresh(derivacion)
        return derivacion

    def get_derivaciones_por_usuario(self, idUsuario: int):
        """
        Derivaciones de las mascotas del dueño autenticado, para que pueda
        ver si tiene una derivación pendiente hacia un especialista.
        """
        return (
            self.db.query(Derivacion)
            .join(Mascota, Derivacion.idMascota == Mascota.idMascota)
            .filter(Mascota.idUsuario == idUsuario)
            .order_by(Derivacion.fechaCreacion.desc())
            .all()
        )

    def update(self, id: int, data: CitaUpdate):
        db_cita = self.get_by_id(id)
        update_data = data.model_dump(exclude_unset=True)
        fecha = update_data.pop("fecha", None)
        if update_data.get("idVeterinario"):
            self._verificar_veterinario(update_data["idVeterinario"])

        # Si cambia la franja o el día de una cita por franja, se recalcula la
        # hora y se revisa el cupo (sin contar la propia cita).
        id_franja = update_data.get("idFranja", db_cita.idFranja)
        if id_franja is not None and ("idFranja" in update_data or fecha is not None):
            franja = self._verificar_franja(id_franja)
            dia = fecha or (update_data.get("fechaHora") or db_cita.fechaHora).date()
            id_vet = update_data.get("idVeterinario", db_cita.idVeterinario)
            motivo_no = self._motivo_franja_no_disponible(franja, dia, id_vet, excluir_id=db_cita.idCita)
            if motivo_no:
                raise HTTPException(
                    status_code=400,
                    detail=f"No se puede mover la cita a la franja de {franja.nombre.lower()}: {motivo_no}"
                )
            update_data["idFranja"] = id_franja
            update_data["fechaHora"] = datetime.combine(dia, franja.hora_inicio)

        for key, value in update_data.items():
            setattr(db_cita, key, value)
        self.db.commit()
        self.db.refresh(db_cita)
        return db_cita

    def cancelar(self, id: int):
        db_cita = self.get_by_id(id)
        db_cita.estado = "cancelada"
        self.db.commit()
        return True

    def enviar_recordatorios_pendientes(self, dias_antes: int = 1):
        from datetime import datetime, timedelta

        from core.email import enviar_email_recordatorio_cita
        from service.automatizacion import _run_async

        objetivo = datetime.now() + timedelta(days=dias_antes)

        ventana_inicio = objetivo.replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0
        )

        ventana_fin = objetivo.replace(
            hour=23,
            minute=59,
            second=59,
            microsecond=999999
        )

        citas = (
            self.db.query(Cita)
            .filter(
                Cita.estado != "cancelada",
                Cita.recordatorio_enviado == False,
                Cita.fechaHora >= ventana_inicio,
                Cita.fechaHora <= ventana_fin
            )
            .all()
        )

        enviados = 0
        con_pendientes = 0

        for cita in citas:

            if not cita.dueno:
                continue

            if not cita.dueno.email:
                continue
            try:
                pendientes = pendientes_de_mascota(self.db, cita.mascota)
            except Exception as exc:
                logger.warning("No se pudieron calcular los pendientes de la cita %s: %s", cita.idCita, exc)
                pendientes = None
            if pendientes and not pendientes["al_dia"]:
                con_pendientes += 1

            _run_async(enviar_email_recordatorio_cita(
                cita.dueno.email,
                cita.dueno.nombre,
                cita.mascota.nombre_mascota,
                cita.fechaHora,
                cita.motivo,
                (f"{cita.franja.nombre} ({cita.franja.hora_inicio.strftime('%H:%M')}–{cita.franja.hora_fin.strftime('%H:%M')})"
            if cita.franja else None),
                pendientes,
            ))
            cita.recordatorio_enviado = True
            enviados += 1

        self.db.commit()

        return {
            "citas_revisadas": len(citas),
            "recordatorios_enviados": enviados,
            "con_pendientes": con_pendientes
        }

    # ------------------------------------------------------------------
    # P2: agenda del veterinario
    # ------------------------------------------------------------------
    def veterinario_de_usuario(self, usuario: User, idVeterinario: int | None = None):
        """
        Un veterinario solo ve SU agenda (se ignora idVeterinario). El administrador
        debe indicar de qué veterinario quiere ver la agenda.
        """
        from models.veterinario import Veterinario
        if usuario.rol == "veterinario":
            vet = self.db.query(Veterinario).filter(Veterinario.idUsuario == usuario.idUsuario).first()
            if not vet:
                raise HTTPException(status_code=404, detail="No se encontró un registro de veterinario asociado a tu cuenta.")
            return vet
        if not idVeterinario:
            raise HTTPException(status_code=400, detail="Indica el veterinario (idVeterinario) para ver su agenda.")
        return self._verificar_veterinario(idVeterinario)

    def _a_cita_agenda(self, c: Cita) -> dict:
        return {
            "idCita": c.idCita,
            "fechaHora": c.fechaHora,
            "motivo": c.motivo,
            "estado": c.estado,
            "idMascota": c.idMascota,
            "nombre_mascota": c.mascota.nombre_mascota if c.mascota else None,
            "especie": c.mascota.especie if c.mascota else None,
            "idUsuario": c.idUsuario,
            "nombre_dueno": f"{c.dueno.nombre} {c.dueno.apellido}".strip() if c.dueno else None,
            "idVeterinario": c.idVeterinario,
            "idFranja": c.idFranja,
            "canal_contacto": c.canal_contacto,
        }

    def agenda_veterinario(self, idVeterinario: int, fecha: date, vista: str = "dia") -> dict:
        """
        Disponibilidad y citas de un veterinario por día o por semana (lunes a domingo).
        Por cada franja: cupos usados / disponibles y las citas que la ocupan.
        """
        if vista not in ("dia", "semana", "mes"):
            raise HTTPException(status_code=400, detail="La vista debe ser 'dia', 'semana' o 'mes'.")
        vet = self._verificar_veterinario(idVeterinario)

        if vista == "semana":
            desde = fecha - timedelta(days=fecha.weekday())
            hasta = desde + timedelta(days=6)
        elif vista == "mes":
            desde = fecha.replace(day=1)
            hasta = (desde.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        else:
            desde = hasta = fecha

        citas = (
            self.db.query(Cita)
            .options(joinedload(Cita.mascota), joinedload(Cita.dueno))
            .filter(
                Cita.idVeterinario == idVeterinario,
                Cita.estado != "cancelada",
                Cita.fechaHora >= datetime.combine(desde, time.min),
                Cita.fechaHora <= datetime.combine(hasta, time.max),
            )
            .order_by(Cita.fechaHora.asc())
            .all()
        )
        por_dia: dict[date, list[Cita]] = {}
        for c in citas:
            por_dia.setdefault(c.fechaHora.date(), []).append(c)

        franjas = self.get_franjas()
        dias = []
        for i in range((hasta - desde).days + 1):
            dia = desde + timedelta(days=i)
            citas_dia = por_dia.get(dia, [])
            bloques = []
            for f in franjas:
                en_franja = [c for c in citas_dia if self._cita_en_franja(c, f)]
                usados = len([c for c in en_franja if c.estado in ("pendiente", "confirmada")])
                motivo = self._motivo_franja_no_disponible(f, dia, idVeterinario)
                bloques.append({
                    "idFranja": f.idFranja,
                    "nombre": f.nombre,
                    "hora_inicio": f.hora_inicio,
                    "hora_fin": f.hora_fin,
                    "cupo_maximo": f.cupo_maximo,
                    "cupos_usados": usados,
                    "cupos_disponibles": max(f.cupo_maximo - usados, 0),
                    "disponible": motivo is None,
                    "motivo_no_disponible": motivo,
                    "citas": [self._a_cita_agenda(c) for c in en_franja],
                })
            dias.append({
                "fecha": dia,
                "dia_semana": self.DIAS_SEMANA[dia.weekday()],
                "total_citas": len(citas_dia),
                "franjas": bloques,
                # Solo las que no caen en ninguna franja (ej. 12:30); el resto ya cuenta en su franja.
                "citas_hora_exacta": [
                    self._a_cita_agenda(c) for c in citas_dia
                    if not any(self._cita_en_franja(c, f) for f in franjas)
                ],
            })

        nombre = f"{vet.usuario.nombre} {vet.usuario.apellido}".strip() if vet.usuario else None
        return {
            "idVeterinario": idVeterinario,
            "nombre_veterinario": nombre,
            "vista": vista,
            "desde": desde,
            "hasta": hasta,
            "total_citas": len(citas),
            "dias": dias,
        }

    def get_sin_asignar(self):
        """Citas pendientes, vigentes y sin veterinario: las que se pueden asignar desde la agenda."""
        citas = (
            self.db.query(Cita)
            .options(joinedload(Cita.mascota), joinedload(Cita.dueno))
            .filter(
                Cita.estado == "pendiente",
                Cita.idVeterinario.is_(None),
                Cita.fechaHora >= datetime.combine(date.today(), time.min),
            )
            .order_by(Cita.fechaHora.asc())
            .all()
        )
        return [self._a_cita_agenda(c) for c in citas]

    def asignar_veterinario(self, idCita: int, idVeterinario: int, usuario: User, confirmar: bool = False):
        """
        Asigna una cita a un veterinario revisando que tenga cupo (franja) o que no
        se cruce con otra cita (hora exacta). El veterinario solo puede asignarse a
        sí mismo citas sin veterinario; reasignar es cosa del administrador.
        """
        cita = self.get_by_id(idCita)
        if cita.estado not in ("pendiente", "confirmada"):
            raise HTTPException(status_code=400, detail="Solo se pueden asignar citas pendientes o confirmadas.")
        vet = self._verificar_veterinario(idVeterinario)

        if usuario.rol == "veterinario":
            if vet.idUsuario != usuario.idUsuario:
                raise HTTPException(status_code=403, detail="Solo puedes asignarte citas a ti mismo.")
            if cita.idVeterinario and cita.idVeterinario != vet.idVeterinario:
                raise HTTPException(
                    status_code=403,
                    detail="La cita ya está asignada a otro veterinario; solo un administrador puede reasignarla."
                )
        if cita.idVeterinario == idVeterinario:
            raise HTTPException(status_code=400, detail="La cita ya está asignada a ese veterinario.")

        dia = cita.fechaHora.date()
        if cita.idFranja is not None:
            if dia < date.today():
                raise HTTPException(status_code=400, detail="No se puede asignar una cita de un día que ya pasó.")
            franja = self._verificar_franja(cita.idFranja)
            if self._contar_cupo(franja, dia, idVeterinario, excluir_id=cita.idCita) >= franja.cupo_maximo:
                raise HTTPException(
                    status_code=400,
                    detail=f"El veterinario no tiene cupo en la franja de {franja.nombre.lower()} del {dia.isoformat()}."
                )
        else:
            if cita.fechaHora < datetime.now():
                raise HTTPException(status_code=400, detail="No se puede asignar una cita que ya pasó.")
            conflicto = self.db.query(Cita).filter(
                Cita.idVeterinario == idVeterinario,
                Cita.idCita != cita.idCita,
                Cita.estado.in_(["pendiente", "confirmada"]),
                Cita.fechaHora > cita.fechaHora - timedelta(minutes=30),
                Cita.fechaHora < cita.fechaHora + timedelta(minutes=30),
            ).first()
            if conflicto:
                raise HTTPException(status_code=400, detail="El veterinario ya tiene una cita en esa franja horaria.")

        cita.idVeterinario = idVeterinario
        if confirmar:
            cita.estado = "confirmada"
        self.db.commit()
        self.db.refresh(cita)
        return cita

    # ------------------------------------------------------------------
    # P4: citas pendientes del dueño + mensaje
    # ------------------------------------------------------------------
    def _mensaje_pendiente(self, c: Cita) -> str:
        hoy = date.today()
        dia = c.fechaHora.date()
        if dia == hoy:
            cuando = "hoy"
        elif dia == hoy + timedelta(days=1):
            cuando = "mañana"
        else:
            cuando = f"el {dia.day} de {self.MESES[dia.month - 1]}"
        momento = (f"en la franja de {c.franja.nombre.lower()}" if c.franja
                else f"a las {c.fechaHora.strftime('%H:%M')}")
        nombre = c.mascota.nombre_mascota if c.mascota else "tu mascota"
        contacto = {
            "telefono": "La clínica te llamará para confirmarla.",
            "correo": "La clínica te escribirá a tu correo para confirmarla.",
            "urgente": "Nos comunicaremos contigo de inmediato.",
        }.get(c.canal_contacto or "app", "La clínica te la confirmará pronto.")
        vet = "" if c.idVeterinario else " Aún no tiene veterinario asignado."
        return f"Tu cita para {nombre} {cuando} {momento} está pendiente de confirmación. {contacto}{vet}"

    def pendientes_del_dueno(self, idUsuario: int):
        citas = (
            self.db.query(Cita)
            .options(joinedload(Cita.mascota), joinedload(Cita.franja), joinedload(Cita.veterinario))
            .filter(
                Cita.idUsuario == idUsuario,
                Cita.estado == "pendiente",
                Cita.fechaHora >= datetime.combine(date.today(), time.min),
            )
            .order_by(Cita.fechaHora.asc())
            .all()
        )
        resultado = []
        for c in citas:
            vet = c.veterinario
            nombre_vet = None
            if vet and vet.usuario:
                nombre_vet = f"{vet.usuario.nombre} {vet.usuario.apellido}".strip()
            resultado.append({
                "idCita": c.idCita,
                "fechaHora": c.fechaHora,
                "motivo": c.motivo,
                "estado": c.estado,
                "idMascota": c.idMascota,
                "nombre_mascota": c.mascota.nombre_mascota if c.mascota else None,
                "idVeterinario": c.idVeterinario,
                "nombre_veterinario": nombre_vet,
                "idFranja": c.idFranja,
                "franja": c.franja,
                "canal_contacto": c.canal_contacto,
                "mensaje": self._mensaje_pendiente(c),
            })
        return resultado