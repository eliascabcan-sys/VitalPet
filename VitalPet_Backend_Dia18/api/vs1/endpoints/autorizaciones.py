from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_roles
from models.user import User
from schemas.autorizacion import (
    AcudienteCreate, AcudienteOut, AcudienteUpdate,
    ConsentimientoCreate, ConsentimientoOut, EstadoAutorizacion,
)
from service.autorizacion import AutorizacionService

router = APIRouter()

# Permisos: el dueño maneja SUS acudientes y SU consentimiento.
# Veterinario y administrador solo pueden CONSULTAR el estado de un dueño.


@router.get("/mias", response_model=EstadoAutorizacion)
def mi_estado(db: Session = Depends(get_db), usuario: User = Depends(require_roles("dueno"))):
    return AutorizacionService(db).estado(usuario)


@router.get("/dueno/{idUsuario}", response_model=EstadoAutorizacion)
def estado_de_un_dueno(
    idUsuario: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario")),
):
    dueno = db.query(User).filter(User.idUsuario == idUsuario, User.rol == "dueno").first()
    if not dueno:
        raise HTTPException(status_code=404, detail="Dueño no encontrado.")
    return AutorizacionService(db).estado(dueno)


@router.get("/acudientes", response_model=list[AcudienteOut])
def mis_acudientes(db: Session = Depends(get_db), usuario: User = Depends(require_roles("dueno"))):
    return AutorizacionService(db).listar_acudientes(usuario.idUsuario)


@router.post("/acudientes", response_model=AcudienteOut, status_code=status.HTTP_201_CREATED)
def crear_acudiente(
    datos: AcudienteCreate,
    db: Session = Depends(get_db),
    usuario: User = Depends(require_roles("dueno")),
):
    return AutorizacionService(db).crear_acudiente(usuario.idUsuario, datos)


@router.put("/acudientes/{idAcudiente}", response_model=AcudienteOut)
def actualizar_acudiente(
    idAcudiente: int,
    datos: AcudienteUpdate,
    db: Session = Depends(get_db),
    usuario: User = Depends(require_roles("dueno")),
):
    return AutorizacionService(db).actualizar_acudiente(usuario.idUsuario, idAcudiente, datos)


@router.delete("/acudientes/{idAcudiente}", status_code=status.HTTP_200_OK)
def quitar_acudiente(
    idAcudiente: int,
    db: Session = Depends(get_db),
    usuario: User = Depends(require_roles("dueno")),
):
    AutorizacionService(db).quitar_acudiente(usuario.idUsuario, idAcudiente)
    return {"detail": "Acudiente eliminado."}


@router.post("/consentimiento", response_model=ConsentimientoOut, status_code=status.HTTP_201_CREATED)
def firmar_consentimiento(
    datos: ConsentimientoCreate,
    db: Session = Depends(get_db),
    usuario: User = Depends(require_roles("dueno")),
):
    return AutorizacionService(db).registrar_consentimiento(usuario.idUsuario, datos)


@router.delete("/consentimiento", status_code=status.HTTP_200_OK)
def revocar_consentimiento(db: Session = Depends(get_db), usuario: User = Depends(require_roles("dueno"))):
    AutorizacionService(db).revocar_consentimiento(usuario.idUsuario)
    return {"detail": "Consentimiento revocado."}