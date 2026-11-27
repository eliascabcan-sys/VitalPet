from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.derivacion import DerivacionCreate, DerivacionOut
from service.citas import CitaService

router = APIRouter()


@router.post("/", response_model=DerivacionOut, status_code=status.HTTP_201_CREATED)
def crear_derivacion(
    data: DerivacionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("veterinario", "administrador"))
):
    """
    El veterinario (general) deriva un caso a un especialista. Se ignora
    el idVeterinarioOrigen que venga en el body y se usa siempre el del
    usuario autenticado, para que nadie pueda crear una derivación a
    nombre de otro veterinario.
    """
    return CitaService(db).derivar_caso(
        idHistorialOrigen=data.idHistorialOrigen,
        idMascota=data.idMascota,
        idVeterinarioOrigen=current_user.idUsuario,
        especialidadDestino=data.especialidadDestino,
    )


@router.get("/mias", response_model=list[DerivacionOut])
def mis_derivaciones(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """El dueño ve las derivaciones de sus propias mascotas (para saber si
    tiene una pendiente antes de intentar agendar con un especialista)."""
    return CitaService(db).get_derivaciones_por_usuario(current_user.idUsuario)
