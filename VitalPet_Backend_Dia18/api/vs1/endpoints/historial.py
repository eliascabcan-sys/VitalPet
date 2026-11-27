from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.historial import (
    EstadoClinicoMascota, HistorialCreate, HistorialOut, HistorialUpdate,
    PesoControlOut, SeccionesGuardar,
)
from service.historial import HistorialService

router = APIRouter()


@router.get("/", response_model=list[HistorialOut])
def obtener_historiales(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario"))
):
    """Solo admin y veterinario ven todos los historiales."""
    return HistorialService(db).get_all()


@router.get("/mias", response_model=list[HistorialOut])
def mis_historiales(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """El dueño consulta el historial de todas sus mascotas."""
    return HistorialService(db).get_by_usuario_dueno(current_user.idUsuario)


@router.get("/mascota/{mascota_id}", response_model=list[HistorialOut])
def historial_por_mascota(
    mascota_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    mascota = HistorialService(db)._verificar_mascota(mascota_id)
    if current_user.rol == "dueno" and mascota.idUsuario != current_user.idUsuario:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="No puedes consultar el historial de una mascota que no te pertenece.")
    return HistorialService(db).get_by_mascota(mascota_id)


@router.get("/mascota/{mascota_id}/es-nueva", response_model=EstadoClinicoMascota)
def mascota_es_nueva(
    mascota_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario"))
):
    """
    ¿La mascota todavía no tiene una consulta real? Si es así, el formulario de
    historia solo permite anamnesis y examen (el diagnóstico queda bloqueado).
    """
    return HistorialService(db).estado_clinico_mascota(mascota_id)


@router.get("/mascota/{mascota_id}/pesos", response_model=list[PesoControlOut])
def pesos_de_la_mascota(
    mascota_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Peso registrado en cada control (para ver la evolución del peso)."""
    mascota = HistorialService(db)._verificar_mascota(mascota_id)
    if current_user.rol == "dueno" and mascota.idUsuario != current_user.idUsuario:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="No puedes consultar el peso de una mascota que no te pertenece.")
    return HistorialService(db).pesos_por_mascota(mascota_id)


@router.get("/{id}", response_model=HistorialOut)
def obtener_historial(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    historial = HistorialService(db).get_by_id(id)
    if current_user.rol == "dueno":
        mascota = historial.mascota
        if not mascota or mascota.idUsuario != current_user.idUsuario:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="No puedes consultar un historial que no te pertenece.")
    return historial


@router.post("/", response_model=HistorialOut, status_code=status.HTTP_201_CREATED)
def crear_historial(
    data: HistorialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrador", "veterinario"))
):
    """Solo admin y veterinario pueden crear registros clínicos."""
    # El autor clínico siempre es el usuario autenticado.
    data = data.model_copy(update={"idUsuario": current_user.idUsuario})
    return HistorialService(db).create(data)


@router.put("/{id}", response_model=HistorialOut)
def actualizar_historial(
    id: int,
    data: HistorialUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario"))
):
    return HistorialService(db).update(id, data)

@router.put("/{id}/secciones", response_model=HistorialOut)
def guardar_secciones(
    id: int,
    data: SeccionesGuardar,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario"))
):
    """Guarda las secciones de texto de la hoja (anamnesis, examen, procedimientos, inyectología)."""
    return HistorialService(db).guardar_secciones(id, data.secciones)


@router.delete("/{id}", status_code=status.HTTP_200_OK)
def eliminar_historial(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador"))
):
    """Solo admin puede eliminar historiales."""
    HistorialService(db).soft_delete(id)
    return {"mensaje": f"Historial {id} eliminado correctamente."}