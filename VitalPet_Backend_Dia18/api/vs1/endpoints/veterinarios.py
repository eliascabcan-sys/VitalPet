from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.veterinario import VeterinarioCreate, VeterinarioOut, VeterinarioUpdate
from service.veterinario import VeterinarioService

router = APIRouter()

@router.get("/", response_model=list[VeterinarioOut])
def obtener_veterinarios(
    especialidad: Optional[str] = Query(
        None,
        description="Ej: 'general'. Si se manda, cualquier usuario autenticado "
                    "puede llamar el endpoint (para que el dueño elija veterinario "
                    "general al agendar). Sin este parámetro, sigue siendo solo admin."
    ),
    incluir_inactivos: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Sin 'especialidad': solo el administrador ve el listado completo.
    Con 'especialidad': cualquier autenticado ve los veterinarios activos
    que coincidan (ej: dueño buscando veterinario general para agendar).
    """
    if especialidad is None and current_user.rol != "administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido. Roles permitidos: administrador"
        )
    vets = VeterinarioService(db).get_all(
        incluir_inactivos=(incluir_inactivos and current_user.rol == "administrador")
    )
    if especialidad is not None:
        especialidad_norm = especialidad.strip().lower()
        vets = [v for v in vets if especialidad_norm in (v.especialidad or "").strip().lower()]
    return vets

@router.get("/me", response_model=VeterinarioOut)
def mi_perfil_profesional(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """
    Cualquier veterinario autenticado ve su propio perfil profesional
    (especialidad, tarjeta profesional). Antes esto solo lo podía ver
    un administrador vía /veterinarios/{id}.
    """
    return VeterinarioService(db).get_by_idUsuario(current_user.idUsuario)

@router.get("/{id}", response_model=VeterinarioOut)
def obtener_veterinario(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    return VeterinarioService(db).get_by_id(id)

@router.post("/", response_model=VeterinarioOut, status_code=status.HTTP_201_CREATED)
def crear_veterinario(data: VeterinarioCreate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    """
    RQF-16: solo un administrador puede crear una cuenta de veterinario.
    Crea el usuario (login) y el registro profesional juntos.
    """
    return VeterinarioService(db).create(data)

@router.put("/{id}", response_model=VeterinarioOut)
def actualizar_veterinario(id: int, data: VeterinarioUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    """El administrador tambien puede resetear la contrasena fija del veterinario."""
    return VeterinarioService(db).update(id, data)

@router.delete("/{id}", status_code=status.HTTP_200_OK)
def desactivar_veterinario(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    """
    Borrado logico: el veterinario (y su cuenta de Usuario) quedan
    'inactivos', nunca se borran fisicamente. RQF-18: rechaza la
    operacion si tiene citas futuras pendientes.
    """
    VeterinarioService(db).soft_delete(id)
    return {"mensaje": f"Veterinario {id} desactivado correctamente."}

@router.put("/{id}/reactivar", response_model=VeterinarioOut)
def reactivar_veterinario(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    """Solo un administrador puede reactivar un veterinario desactivado."""
    return VeterinarioService(db).reactivar(id)