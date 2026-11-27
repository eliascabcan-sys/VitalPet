from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from models.mascota import Mascota
from schemas.seguimiento import (
    PlantillaCreate, PlantillaOut, PlantillaUpdate,
    PreguntaCreate, PreguntaOut, PreguntaUpdate,
    SeguimientoCreate, SeguimientoOut,
    ResponderPregunta, RespuestaOut, AlertaOut,
)
from service.seguimiento import PlantillaService, SeguimientoService

router = APIRouter()

# ============================================
# PLANTILLAS (configuracion: solo admin/veterinario)
# ============================================
@router.get("/plantillas", response_model=list[PlantillaOut])
def listar_plantillas(db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    return PlantillaService(db).get_all()


@router.post("/plantillas/ejemplos", response_model=list[PlantillaOut])
def crear_plantillas_ejemplo(db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    return PlantillaService(db).crear_plantillas_ejemplo()

@router.post("/plantillas", response_model=PlantillaOut, status_code=status.HTTP_201_CREATED)
def crear_plantilla(data: PlantillaCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    return PlantillaService(db).create(data)

@router.put("/plantillas/{id}", response_model=PlantillaOut)
def actualizar_plantilla(id: int, data: PlantillaUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    return PlantillaService(db).update(id, data)

@router.delete("/plantillas/{id}", status_code=status.HTTP_200_OK)
def eliminar_plantilla(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    PlantillaService(db).soft_delete(id)
    return {"mensaje": f"Plantilla {id} desactivada correctamente."}

# ── Preguntas de una plantilla ──────────────────────────────────────────────
@router.get("/plantillas/{idPlantilla}/preguntas", response_model=list[PreguntaOut])
def listar_preguntas(idPlantilla: int, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    return PlantillaService(db).preguntas_de(idPlantilla)

@router.post("/plantillas/{idPlantilla}/preguntas", response_model=PreguntaOut, status_code=status.HTTP_201_CREATED)
def agregar_pregunta(idPlantilla: int, data: PreguntaCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    return PlantillaService(db).agregar_pregunta(idPlantilla, data)

@router.put("/preguntas/{idPregunta}", response_model=PreguntaOut)
def actualizar_pregunta(idPregunta: int, data: PreguntaUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    return PlantillaService(db).actualizar_pregunta(idPregunta, data)

@router.delete("/preguntas/{idPregunta}", status_code=status.HTTP_200_OK)
def eliminar_pregunta(idPregunta: int, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    PlantillaService(db).eliminar_pregunta(idPregunta)
    return {"mensaje": f"Pregunta {idPregunta} eliminada correctamente."}

# ============================================
# SEGUIMIENTOS (el ciclo real)
# ============================================
@router.post("/", response_model=SeguimientoOut, status_code=status.HTTP_201_CREATED)
def iniciar_seguimiento(data: SeguimientoCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    """RQF-25: el veterinario activa un seguimiento sobre un diagnostico ya registrado."""
    return SeguimientoService(db).iniciar(data)

@router.get("/mascota/{idMascota}", response_model=list[SeguimientoOut])
def seguimientos_de_mascota(idMascota: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.rol == "dueno":
        mascota = db.query(Mascota).filter(Mascota.idMascota == idMascota).first()
        if not mascota:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Mascota no encontrada.")
        if mascota.idUsuario != current_user.idUsuario:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="No puedes consultar seguimientos de otra mascota.")
    return SeguimientoService(db).get_by_mascota(idMascota)

# ── Preguntas pendientes / respuestas del dueno ─────────────────────────────
@router.get("/mias/pendientes", response_model=list[RespuestaOut])
def mis_preguntas_pendientes(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """
    RQF-28: preguntas de seguimiento que YA le tocan al dueño autenticado
    (de cualquiera de sus mascotas) y que todavia no ha respondido.

    "Le tocan" significa: un veterinario activo un seguimiento sobre un
    diagnostico (POST /seguimientos/), la plantilla de ese seguimiento
    trae preguntas programadas para cierto numero de dias despues del
    diagnostico, y ese plazo ya se cumplio. No es algo que el dueño
    inicia: aparece solo cuando corresponde.

    Cada item trae 'nombre_mascota' para saber de cual mascota es la
    pregunta (un dueño puede tener varias con seguimientos activos a la
    vez). Para responder, se usa 'idRespuesta' contra POST
    /seguimientos/respuestas/{idRespuesta}.
    """
    return SeguimientoService(db).preguntas_pendientes_para_dueno(current_user.idUsuario)

@router.post("/respuestas/{idRespuesta}", response_model=RespuestaOut)
def responder_pregunta(idRespuesta: int, data: ResponderPregunta, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """RQF-29: el dueno responde bien/regular/mal. Si responde 'mal', se genera la alerta automaticamente."""
    return SeguimientoService(db).responder(idRespuesta, data, current_user.idUsuario, background_tasks)

# ── Alertas (solo personal clinico) ─────────────────────────────────────────
@router.get("/alertas/pendientes", response_model=list[AlertaOut])
def alertas_pendientes(db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    """RQF-31/32: alertas que el veterinario/admin todavia no ha revisado."""
    return SeguimientoService(db).alertas_pendientes_veterinario()

@router.put("/alertas/{idAlerta}/vista", response_model=AlertaOut)
def marcar_alerta_vista(idAlerta: int, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador", "veterinario"))):
    return SeguimientoService(db).marcar_alerta_vista(idAlerta)

@router.get("/{id}", response_model=SeguimientoOut)
def obtener_seguimiento(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    seguimiento = SeguimientoService(db).get_by_id(id)
    # Día 12 · P5: un dueño solo puede ver los seguimientos de SUS mascotas.
    if current_user.rol == "dueno" and getattr(seguimiento, "idDueno", None) != current_user.idUsuario:
        raise HTTPException(status_code=403, detail="No puedes consultar un seguimiento que no te pertenece.")
    return seguimiento