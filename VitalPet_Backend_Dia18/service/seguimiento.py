from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from models.historial import HistorialClinico
from models.mascota import Mascota
from models.plantilla_seguimiento import PlantillaSeguimiento
from models.pregunta_plantilla import PreguntaPlantilla
from models.seguimiento import Seguimiento
from models.respuesta_seguimiento import RespuestaSeguimiento
from models.alerta_seguimiento import AlertaSeguimiento
from service.alerta_grave import notificar_alerta_grave, preparar_notificacion_alerta_grave
from schemas.seguimiento import (
    PlantillaCreate, PlantillaUpdate,
    PreguntaCreate, PreguntaUpdate,
    SeguimientoCreate, ResponderPregunta,
)


class PlantillaService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self):
        return self.db.query(PlantillaSeguimiento).filter(PlantillaSeguimiento.estado == "activo").all()

    def get_by_id(self, id: int):
        p = self.db.query(PlantillaSeguimiento).filter(PlantillaSeguimiento.idPlantilla == id).first()
        if not p:
            raise HTTPException(status_code=404, detail=f"La plantilla con id {id} no existe en el sistema.")
        return p

    def buscar_por_animal_diagnostico(self, tipo_animal: str, diagnostico: str):

        return self.db.query(PlantillaSeguimiento).filter(
            PlantillaSeguimiento.estado == "activo",
            PlantillaSeguimiento.tipo_animal.ilike(tipo_animal),
            PlantillaSeguimiento.diagnostico.ilike(f"%{diagnostico}%"),
        ).first()

    def create(self, data: PlantillaCreate):
        db_p = PlantillaSeguimiento(**data.model_dump())
        self.db.add(db_p)
        self.db.commit()
        self.db.refresh(db_p)
        return db_p

    def update(self, id: int, data: PlantillaUpdate):
        db_p = self.get_by_id(id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(db_p, key, value)
        self.db.commit()
        self.db.refresh(db_p)
        return db_p

    def soft_delete(self, id: int):
        db_p = self.get_by_id(id)
        db_p.estado = "inactivo"
        self.db.commit()
        return True

    def agregar_pregunta(self, idPlantilla: int, data: PreguntaCreate):
        self.get_by_id(idPlantilla)  # valida que exista
        db_preg = PreguntaPlantilla(idPlantilla=idPlantilla, **data.model_dump())
        self.db.add(db_preg)
        self.db.commit()
        self.db.refresh(db_preg)
        return db_preg

    def preguntas_de(self, idPlantilla: int):
        self.get_by_id(idPlantilla)
        return self.db.query(PreguntaPlantilla).filter(
            PreguntaPlantilla.idPlantilla == idPlantilla,
            PreguntaPlantilla.estado == "activo",
        ).order_by(PreguntaPlantilla.orden).all()

    def actualizar_pregunta(self, idPregunta: int, data: PreguntaUpdate):
        preg = self.db.query(PreguntaPlantilla).filter(PreguntaPlantilla.idPregunta == idPregunta).first()
        if not preg:
            raise HTTPException(status_code=404, detail=f"La pregunta con id {idPregunta} no existe.")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(preg, key, value)
        self.db.commit()
        self.db.refresh(preg)
        return preg

    def eliminar_pregunta(self, idPregunta: int):

        preg = self.db.query(PreguntaPlantilla).filter(PreguntaPlantilla.idPregunta == idPregunta).first()
        if not preg:
            raise HTTPException(status_code=404, detail=f"La pregunta con id {idPregunta} no existe.")
        preg.estado = "inactivo"
        self.db.commit()
        return True

    def reactivar_pregunta(self, idPregunta: int):

        preg = self.db.query(PreguntaPlantilla).filter(PreguntaPlantilla.idPregunta == idPregunta).first()
        if not preg:
            raise HTTPException(status_code=404, detail=f"La pregunta con id {idPregunta} no existe.")
        preg.estado = "activo"
        self.db.commit()
        self.db.refresh(preg)
        return preg



NIVEL_ORDEN = {"verde": 0, "amarillo": 1, "naranja": 2, "rojo": 3}

def _nivel_por_puntos(puntos: int) -> str:
    if puntos >= 5: return "rojo"
    if puntos >= 3: return "naranja"
    if puntos >= 1: return "amarillo"
    return "verde"

def _nivel_subir(nivel: str) -> str:
    return {"verde": "amarillo", "amarillo": "naranja", "naranja": "rojo", "rojo": "rojo"}.get(nivel, "verde")

def _opcion_para(pregunta, valor: str):
    # Escala numérica 1-10: 1 = bien (sin alerta) ... 10 = muy grave (alerta roja)
    if (getattr(pregunta, "tipo_respuesta", None) or "") == "numero":
        try:
            n = int(round(float(str(valor).replace(",", "."))))
        except ValueError:
            n = 1
        n = max(1, min(10, n))
        nivel = "verde" if n <= 2 else "amarillo" if n <= 4 else "naranja" if n <= 7 else "rojo"
        return {"puntos": n - 1, "nivel": nivel, "bandera_roja": n == 10}

    opciones = pregunta.opciones or []
    for opcion in opciones:
        if isinstance(opcion, dict) and str(opcion.get("valor", "")).lower() == valor.lower():
            return opcion
    # Compatibilidad histórica bien/regular/mal.
    return {
        "bien": {"puntos": 0, "nivel": "verde", "bandera_roja": False},
        "regular": {"puntos": 2, "nivel": "amarillo", "bandera_roja": False},
        "mal": {"puntos": 5, "nivel": pregunta.nivel_alerta_si_mal or "naranja", "bandera_roja": True},
    }.get(valor.lower(), {"puntos": 0, "nivel": "verde", "bandera_roja": False})


    def crear_plantillas_ejemplo(self):
        ejemplos = [
            {
                "nombre": "Seguimiento por vómito", "tipo_animal": "Canino", "diagnostico": "Vómito",
                "preguntas": [
                    ("¿Ha vomitado nuevamente?", 1, 1, [
                        {"valor":"bien","etiqueta":"No","puntos":0,"nivel":"verde","bandera_roja":False},
                        {"valor":"regular","etiqueta":"Una vez","puntos":2,"nivel":"amarillo","bandera_roja":False},
                        {"valor":"mal","etiqueta":"Varias veces","puntos":5,"nivel":"rojo","bandera_roja":True}])]
            },
            {
                "nombre": "Seguimiento por diarrea", "tipo_animal": "Canino", "diagnostico": "Diarrea",
                "preguntas": [
                    ("¿Cómo está la diarrea hoy?", 1, 1, [
                        {"valor":"bien","etiqueta":"Ya no tiene","puntos":0,"nivel":"verde","bandera_roja":False},
                        {"valor":"regular","etiqueta":"Continúa leve","puntos":2,"nivel":"amarillo","bandera_roja":False},
                        {"valor":"mal","etiqueta":"Es frecuente o con sangre","puntos":5,"nivel":"rojo","bandera_roja":True}])]
            },
            {
                "nombre": "Seguimiento post-cirugía", "tipo_animal": "Canino", "diagnostico": "Post-cirugía",
                "preguntas": [
                    ("¿La herida presenta sangrado o secreción?", 1, 1, [
                        {"valor":"bien","etiqueta":"No","puntos":0,"nivel":"verde","bandera_roja":False},
                        {"valor":"regular","etiqueta":"Leve","puntos":2,"nivel":"amarillo","bandera_roja":False},
                        {"valor":"mal","etiqueta":"Sí, es abundante","puntos":5,"nivel":"rojo","bandera_roja":True}])]
            },
        ]
        creadas=[]
        for e in ejemplos:
            plantilla=self.db.query(PlantillaSeguimiento).filter(PlantillaSeguimiento.nombre==e["nombre"]).first()
            if not plantilla:
                plantilla=PlantillaSeguimiento(nombre=e["nombre"], tipo_animal=e["tipo_animal"], diagnostico=e["diagnostico"])
                self.db.add(plantilla); self.db.flush()
            for texto,dias,orden,opciones in e["preguntas"]:
                q=self.db.query(PreguntaPlantilla).filter(PreguntaPlantilla.idPlantilla==plantilla.idPlantilla, PreguntaPlantilla.texto_pregunta==texto).first()
                if not q:
                    q=PreguntaPlantilla(idPlantilla=plantilla.idPlantilla,texto_pregunta=texto,dias_desde_diagnostico=dias,orden=orden,nivel_alerta_si_mal="rojo",tipo_respuesta="opciones",opciones=opciones)
                    self.db.add(q)
            creadas.append(plantilla)
        self.db.commit()
        return creadas

class SeguimientoService:
    def __init__(self, db: Session):
        self.db = db

    def _query_base(self):
        return self.db.query(Seguimiento).options(
            joinedload(Seguimiento.respuestas).joinedload(RespuestaSeguimiento.pregunta)
        )

    def _enriquecer(self, s):
        """Añade trazabilidad explícita del seguimiento."""
        if s and s.historial and s.historial.mascota:
            mascota = s.historial.mascota
            s.__dict__["idMascota"] = mascota.idMascota
            s.__dict__["idDueno"] = mascota.idUsuario
            s.__dict__["nombre_mascota"] = mascota.nombre_mascota
            s.__dict__["diagnostico"] = s.historial.diagnostico
        return s

    def get_by_id(self, id: int):
        s = self._query_base().options(joinedload(Seguimiento.historial).joinedload(HistorialClinico.mascota)).filter(
            Seguimiento.idSeguimiento == id
        ).first()
        if not s:
            raise HTTPException(status_code=404, detail=f"El seguimiento con id {id} no existe en el sistema.")
        return self._enriquecer(s)

    def get_by_mascota(self, idMascota: int):
        items = self._query_base().options(
            joinedload(Seguimiento.historial).joinedload(HistorialClinico.mascota)
        ).join(HistorialClinico).filter(
            HistorialClinico.idMascota == idMascota
        ).all()
        return [self._enriquecer(s) for s in items]

    def get_by_mascota_para_usuario(self, idMascota: int, idUsuario: int):
        items = (
            self._query_base()
            .options(joinedload(Seguimiento.historial).joinedload(HistorialClinico.mascota))
            .join(HistorialClinico)
            .join(HistorialClinico.mascota)
            .filter(
                HistorialClinico.idMascota == idMascota,
                Mascota.idUsuario == idUsuario,
            )
            .all()
        )
        return [self._enriquecer(s) for s in items]

    def iniciar(self, data: SeguimientoCreate):

        historial = self.db.query(HistorialClinico).filter(
            HistorialClinico.idHistorial == data.idHistorial
        ).first()
        if not historial:
            raise HTTPException(status_code=404, detail=f"El historial con id {data.idHistorial} no existe.")

        plantilla = self.db.query(PlantillaSeguimiento).filter(
            PlantillaSeguimiento.idPlantilla == data.idPlantilla,
            PlantillaSeguimiento.estado == "activo",
        ).first()
        if not plantilla:
            raise HTTPException(status_code=404, detail=f"La plantilla con id {data.idPlantilla} no existe o esta inactiva.")

        preguntas = self.db.query(PreguntaPlantilla).filter(
            PreguntaPlantilla.idPlantilla == data.idPlantilla,
            PreguntaPlantilla.estado == "activo",
        ).order_by(PreguntaPlantilla.orden.asc()).all()
        if not preguntas:
            raise HTTPException(status_code=400, detail="Esa plantilla no tiene preguntas configuradas todavia.")

        existente = self.db.query(Seguimiento).filter(
            Seguimiento.idHistorial == data.idHistorial,
            Seguimiento.idPlantilla == data.idPlantilla,
            Seguimiento.estado == "en_curso",
        ).first()

        if existente:
            # Ya existe un seguimiento en curso para esta combinacion
            # mascota+plantilla. En vez de no hacer nada, se rellenan
            # (backfill) las preguntas activas que todavia no tengan
            # una fila de respuesta programada: cubre el caso de haber
            # agregado preguntas nuevas a la plantilla despues de haber
            # iniciado el seguimiento, o de haber vuelto a pulsar
            # "Iniciar seguimiento" antes de terminar de configurarla.
            ya_programadas = {
                r.idPregunta for r in self.db.query(RespuestaSeguimiento)
                .filter(RespuestaSeguimiento.idSeguimiento == existente.idSeguimiento)
                .all()
            }
            faltantes = [p for p in preguntas if p.idPregunta not in ya_programadas]
            if faltantes:
                fecha_base = existente.fecha_diagnostico or datetime.now(timezone.utc).replace(tzinfo=None)
                for p in faltantes:
                    fecha_programada = fecha_base + timedelta(days=p.dias_desde_diagnostico)
                    self.db.add(RespuestaSeguimiento(
                        idSeguimiento=existente.idSeguimiento,
                        idPregunta=p.idPregunta,
                        fecha_programada=fecha_programada,
                        estado_envio="pendiente",
                    ))
                self.db.commit()
            return self.get_by_id(existente.idSeguimiento)

        fecha_base = datetime.now(timezone.utc).replace(tzinfo=None)
        db_seg = Seguimiento(idHistorial=data.idHistorial, idPlantilla=data.idPlantilla, fecha_diagnostico=fecha_base)
        self.db.add(db_seg)
        self.db.flush()

        for p in preguntas:
            fecha_programada = fecha_base + timedelta(days=p.dias_desde_diagnostico)
            self.db.add(RespuestaSeguimiento(
                idSeguimiento=db_seg.idSeguimiento,
                idPregunta=p.idPregunta,
                fecha_programada=fecha_programada,
                estado_envio="pendiente",
            ))

        self.db.commit()
        self.db.refresh(db_seg)
        return self.get_by_id(db_seg.idSeguimiento)

    def preguntas_pendientes_para_dueno(self, idUsuarioDueno: int):

        ahora = datetime.now(timezone.utc).replace(tzinfo=None)
        propias = (
            self.db.query(RespuestaSeguimiento)
            .join(Seguimiento)
            .join(HistorialClinico)
            .join(HistorialClinico.mascota)
            .options(
                joinedload(RespuestaSeguimiento.seguimiento)
                .joinedload(Seguimiento.historial)
                .joinedload(HistorialClinico.mascota),
                joinedload(RespuestaSeguimiento.pregunta),
            )
            .filter(
                Mascota.idUsuario == idUsuarioDueno,
                RespuestaSeguimiento.estado_envio != "respondida",
                RespuestaSeguimiento.fecha_programada <= ahora,
            )
            .order_by(RespuestaSeguimiento.fecha_programada.asc(), RespuestaSeguimiento.idRespuesta.asc())
            .all()
        )

        for r in propias:
            if r.estado_envio == "pendiente":
                r.estado_envio = "enviada"
                r.fecha_envio = ahora
        if propias:
            self.db.commit()

        for r in propias:
            mascota = r.seguimiento.historial.mascota
            r.__dict__["texto_pregunta"] = r.pregunta.texto_pregunta
            r.__dict__["nombre_mascota"] = mascota.nombre_mascota
            r.__dict__["idMascota"] = mascota.idMascota
            r.__dict__["idDueno"] = mascota.idUsuario
            r.__dict__["tipo_respuesta"] = r.pregunta.tipo_respuesta
            r.__dict__["opciones"] = r.pregunta.opciones
        return propias

    def responder(self, idRespuesta: int, data: ResponderPregunta, idUsuarioDueno: int, background_tasks=None):

        respuesta = self.db.query(RespuestaSeguimiento).filter(
            RespuestaSeguimiento.idRespuesta == idRespuesta
        ).first()
        if not respuesta:
            raise HTTPException(status_code=404, detail=f"La respuesta con id {idRespuesta} no existe.")

        dueno_id = respuesta.seguimiento.historial.mascota.idUsuario
        if dueno_id != idUsuarioDueno:
            raise HTTPException(status_code=403, detail="Esta pregunta no pertenece a una mascota tuya.")

        if respuesta.estado_envio == "respondida":
            raise HTTPException(status_code=400, detail="Esta pregunta ya fue respondida.")

        # Validar la respuesta según el tipo de pregunta de la plantilla
        tipo = respuesta.pregunta.tipo_respuesta or "bien_regular_mal"
        valor_resp = data.respuesta.strip()
        if tipo == "numero":
            try:
                if not 1 <= float(valor_resp.replace(",", ".")) <= 10:
                    raise ValueError
            except ValueError:
                raise HTTPException(status_code=400, detail="La respuesta debe ser un número del 1 al 10.")
        elif tipo in ("opciones", "si_no") and respuesta.pregunta.opciones:
            validos = {str(o.get("valor", "")).lower() for o in respuesta.pregunta.opciones if isinstance(o, dict)}
            if valor_resp.lower() not in validos:
                raise HTTPException(status_code=400, detail="La respuesta no es una de las opciones disponibles.")
        ahora = datetime.now(timezone.utc).replace(tzinfo=None)
        opcion = _opcion_para(respuesta.pregunta, data.respuesta)
        puntos = int(opcion.get("puntos", 0) or 0)
        nivel = opcion.get("nivel") or _nivel_por_puntos(puntos)
        bandera_roja = bool(opcion.get("bandera_roja", False))
        nivel = "rojo" if bandera_roja else nivel

        # Tendencia: compara contra la respuesta anterior de la misma pregunta
        # para la misma mascota. Si empeora, sube un nivel.
        mascota_id = respuesta.seguimiento.historial.idMascota
        anterior = (
            self.db.query(RespuestaSeguimiento)
            .join(Seguimiento)
            .join(HistorialClinico)
            .filter(
                RespuestaSeguimiento.idPregunta == respuesta.idPregunta,
                RespuestaSeguimiento.idRespuesta != respuesta.idRespuesta,
                RespuestaSeguimiento.estado_envio == "respondida",
                HistorialClinico.idMascota == mascota_id,
            )
            .order_by(RespuestaSeguimiento.fecha_respuesta.desc())
            .first()
        )
        tendencia_empeora = anterior is not None and puntos > (anterior.puntos or 0)
        if tendencia_empeora:
            nivel = _nivel_subir(nivel)

        respuesta.respuesta = data.respuesta
        respuesta.puntos = puntos
        respuesta.nivel = nivel
        respuesta.bandera_roja = bandera_roja
        respuesta.estado_envio = "respondida"
        respuesta.fecha_respuesta = ahora
        self.db.commit()
        self.db.refresh(respuesta)

        # Una respuesta con nivel de alerta, bandera roja o tendencia que
        # empeora genera una alerta. La alerta conserva el nivel original.
        if nivel != "verde" or bandera_roja or tendencia_empeora:
            alerta = AlertaSeguimiento(
                idSeguimiento=respuesta.idSeguimiento,
                idRespuesta=respuesta.idRespuesta,
                nivel=nivel,
                nivel_original=nivel,
                fecha_nivel=ahora,
                puntos=puntos,
                bandera_roja=bandera_roja,
            )
            self.db.add(alerta)
            self.db.commit()
        
        if nivel == "rojo":
            enviar = preparar_notificacion_alerta_grave(
                self.db, respuesta.seguimiento.historial.mascota,
                f"Respuesta a «{respuesta.pregunta.texto_pregunta}»: {data.respuesta}.",
                "Seguimiento posconsulta",
            )
            if background_tasks is not None:
                background_tasks.add_task(enviar)  # los correos salen después de responder
            else:
                enviar()

        return respuesta

    def alertas_pendientes_veterinario(self):
        alertas = self.db.query(AlertaSeguimiento).options(
            joinedload(AlertaSeguimiento.respuesta).joinedload(RespuestaSeguimiento.pregunta),
            joinedload(AlertaSeguimiento.seguimiento).joinedload(Seguimiento.historial).joinedload(HistorialClinico.mascota),
        ).filter(
            AlertaSeguimiento.notificado_veterinario == False
        ).order_by(AlertaSeguimiento.fecha_generada.desc()).all()

        for a in alertas:
            if a.seguimiento and a.seguimiento.historial and a.seguimiento.historial.mascota:
                mascota = a.seguimiento.historial.mascota
                a.__dict__["idMascota"] = mascota.idMascota
                a.__dict__["nombre_mascota"] = mascota.nombre_mascota
            if a.respuesta and a.respuesta.pregunta:
                a.__dict__["texto_pregunta"] = a.respuesta.pregunta.texto_pregunta

        return alertas
        
    def marcar_alerta_vista(self, idAlerta: int):
        """El veterinario/admin ya vio la alerta: deja de reescalarse."""
        alerta = self.db.query(AlertaSeguimiento).filter(
            AlertaSeguimiento.idAlerta == idAlerta
        ).first()
        if not alerta:
            raise HTTPException(status_code=404, detail=f"La alerta con id {idAlerta} no existe.")
        alerta.notificado_veterinario = True
        # Agregado por P4: el campo "estado" (ver CONTRATO.md) tampoco debe
        # quedarse en "pendiente" una vez el veterinario ya la vio.
        alerta.estado = "vista"
        self.db.commit()
        self.db.refresh(alerta)
        return alerta