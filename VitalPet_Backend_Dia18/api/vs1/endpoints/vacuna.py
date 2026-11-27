from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import (
    get_current_active_user,
    require_roles
)

from models.user import User
from models.mascota import Mascota
from schemas.vacuna import (
    VacunaCreate,
    VacunaOut,
    VacunaUpdate
)

from service.vacuna import VacunaService


router = APIRouter()


@router.get(
    "/mascota/{idMascota}",
    response_model=list[VacunaOut]
)
def carnet_de_vacunacion(
    idMascota: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    vacuna_service = VacunaService(db)
    mascota = db.query(Mascota).filter(Mascota.idMascota == idMascota).first()
    if not mascota:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"La mascota con id {idMascota} no existe.")
    if current_user.rol == "dueno" and mascota.idUsuario != current_user.idUsuario:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="No puedes consultar la certificación de vacunación de una mascota que no te pertenece.")
    return vacuna_service.get_by_mascota(idMascota)


@router.get(
    "/{id}",
    response_model=VacunaOut
)
def obtener_vacuna(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    vacuna = VacunaService(db).get_by_id(id)
    if current_user.rol == "dueno" and vacuna.mascota.idUsuario != current_user.idUsuario:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="No puedes consultar una vacuna que no pertenece a una mascota tuya.")
    return vacuna


@router.post(
    "/",
    response_model=VacunaOut,
    status_code=status.HTTP_201_CREATED
)
def registrar_vacuna(
    data: VacunaCreate,
    db: Session = Depends(get_db),
    _: User = Depends(
        require_roles("administrador", "veterinario")
    )
):
    return VacunaService(db).create(data)


@router.put(
    "/{id}",
    response_model=VacunaOut
)
def actualizar_vacuna(
    id: int,
    data: VacunaUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(
        require_roles("administrador", "veterinario")
    )
):
    return VacunaService(db).update(id, data)


@router.delete(
    "/{id}",
    status_code=status.HTTP_200_OK
)
def desactivar_vacuna(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(
        require_roles("administrador")
    )
):
    VacunaService(db).soft_delete(id)

    return {
        "mensaje": f"Vacuna {id} desactivada correctamente."
    }


@router.put(
    "/{id}/reactivar",
    response_model=VacunaOut
)
def reactivar_vacuna(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(
        require_roles("administrador")
    )
):
    return VacunaService(db).reactivar(id)