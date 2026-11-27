from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.mascota import MascotaCreate, MascotaListaOut, MascotaOut, MascotaUpdate
from service.mascota import MascotaService

router = APIRouter()


@router.get("/", response_model=list[MascotaListaOut])
def obtener_mascotas(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario"))
):
    return MascotaService(db).get_all()


@router.get("/mias", response_model=list[MascotaOut])
def mis_mascotas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return MascotaService(db).get_by_usuario(current_user.idUsuario)


@router.get("/{id}", response_model=MascotaOut)
def obtener_mascota(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    mascota = MascotaService(db).get_by_id(id)
    if current_user.rol == "dueno" and mascota.idUsuario != current_user.idUsuario:
        raise HTTPException(status_code=403, detail="No puedes acceder a una mascota que no te pertenece.")
    return mascota


@router.post("/", response_model=MascotaOut, status_code=status.HTTP_201_CREATED)
def crear_mascota(
    mascota: MascotaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # El dueño nunca puede registrar una mascota a nombre de otra persona.
    if current_user.rol == "dueno":
        mascota = mascota.model_copy(update={"idUsuario": current_user.idUsuario})
    elif mascota.idUsuario != current_user.idUsuario and current_user.rol not in {"administrador", "veterinario"}:
        raise HTTPException(status_code=403, detail="No tienes permiso para registrar mascotas de otro usuario.")
    return MascotaService(db).create(mascota, current_user.idUsuario)


@router.put("/{id}", response_model=MascotaOut)
def actualizar_mascota(
    id: int,
    mascota: MascotaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    actual = MascotaService(db).get_by_id(id)
    if current_user.rol == "dueno" and actual.idUsuario != current_user.idUsuario:
        raise HTTPException(status_code=403, detail="No puedes modificar una mascota que no te pertenece.")
    return MascotaService(db).update(id, mascota)


@router.delete("/{id}", status_code=status.HTTP_200_OK)
def eliminar_mascota(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario"))
):
    MascotaService(db).soft_delete(id)
    return {"mensaje": f"Mascota {id} eliminada correctamente."}


@router.put("/{id}/reactivar", response_model=MascotaOut)
def reactivar_mascota(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario"))
):
    return MascotaService(db).reactivar(id)
