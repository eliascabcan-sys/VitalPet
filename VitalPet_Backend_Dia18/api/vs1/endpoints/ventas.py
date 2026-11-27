from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.venta import VentaCreate, VentaOut, VentaUpdate
from service.venta import VentaService

router = APIRouter()

# ── CRUD de ventas — reglas por rol ─────────────────────────────────────────
# CREATE (POST /):    cualquier autenticado.
#                        - dueño: SIEMPRE se registra a su propio idUsuario,
#                          sin importar lo que mande en el body (evita que
#                          alguien registre compras a nombre de otro dueño).
#                        - admin/veterinario: pueden vender a nombre de
#                          cualquier dueño (venta en mostrador), usan el
#                          idUsuario que manden en el body.
# READ ALL (GET /):    solo admin (ve todas las ventas del negocio).
# READ MIAS (GET /mias): cualquier autenticado ve su propio historial de
#                        compras (esto es lo que alimenta la pantalla de
#                        "historial de compras" del dueño en el frontend).
# READ ONE (GET /{id}): admin, o el dueño de esa venta. Nadie más.
# UPDATE (PUT /{id}):  solo admin, cambia el estado (pendiente->pagada).
# DELETE (DELETE /{id}): solo admin, cancela y repone el stock.

@router.get("/", response_model=list[VentaOut])
def obtener_ventas(db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    """Solo admin ve el historial completo de ventas del negocio."""
    return VentaService(db).get_all()

@router.get("/mias", response_model=list[VentaOut])
def mis_ventas(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Historial de compras del usuario autenticado (dueño, veterinario o admin)."""
    return VentaService(db).get_by_usuario(current_user.idUsuario)

@router.get("/{id}", response_model=VentaOut)
def obtener_venta(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    venta = VentaService(db).get_by_id(id)
    if current_user.rol != "administrador" and venta.idUsuario != current_user.idUsuario:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes ver una venta que no es tuya."
        )
    return venta

@router.post("/", response_model=VentaOut, status_code=status.HTTP_201_CREATED)
def crear_venta(data: VentaCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.rol == "dueno":
        # Un dueño solo puede registrar compras a su propio nombre.
        data = data.model_copy(update={"idUsuario": current_user.idUsuario})
    return VentaService(db).create(data)

@router.put("/{id}", response_model=VentaOut)
def actualizar_venta(id: int, data: VentaUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    return VentaService(db).update(id, data)

@router.delete("/{id}", status_code=status.HTTP_200_OK)
def cancelar_venta(id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("administrador"))):
    VentaService(db).cancelar(id)
    return {"mensaje": f"Venta {id} cancelada correctamente."}