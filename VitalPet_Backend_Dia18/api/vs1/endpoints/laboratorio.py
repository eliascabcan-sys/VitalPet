from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.laboratorio import ExamenCreate, ExamenOut, ExamenUpdate
from service.laboratorio import LaboratorioService
from fastapi import APIRouter, Depends, Query, status
from schemas.laboratorio import Estado, ExamenCreate, ExamenListaOut, ExamenOut, ExamenUpdate

router = APIRouter()

# Veterinario / administrador: crean y editan. Dueño: solo consulta lo suyo.

@router.get("/", response_model=list[ExamenListaOut])
def listar_examenes(
    estado: Estado | None = Query(None),
    buscar: str | None = Query(None, max_length=100),
    limite: int = Query(300, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario")),
):
    """Pantalla del laboratorio: todos los exámenes, con los pendientes primero."""
    return LaboratorioService(db).listar_todos(estado, buscar, limite)

@router.get("/mias", response_model=list[ExamenOut])
def mis_examenes(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Exámenes de todas las mascotas del usuario autenticado."""
    return LaboratorioService(db).del_dueno(current_user)


@router.get("/historial/{idHistorial}", response_model=list[ExamenOut])
def examenes_del_historial(idHistorial: int, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_active_user)):
    return LaboratorioService(db).por_historial(idHistorial, current_user)


@router.get("/mascota/{idMascota}", response_model=list[ExamenOut])
def examenes_de_la_mascota(idMascota: int, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_active_user)):
    return LaboratorioService(db).por_mascota(idMascota, current_user)


@router.get("/{idExamen}", response_model=ExamenOut)
def obtener_examen(idExamen: int, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_active_user)):
    return LaboratorioService(db).get_visible(idExamen, current_user)


@router.post("/", response_model=ExamenOut, status_code=status.HTTP_201_CREATED)
def solicitar_examen(data: ExamenCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_roles("administrador", "veterinario"))):
    return LaboratorioService(db).crear(data, current_user)


@router.put("/{idExamen}", response_model=ExamenOut)
def actualizar_examen(idExamen: int, data: ExamenUpdate, db: Session = Depends(get_db),
                    _: User = Depends(require_roles("administrador", "veterinario"))):
    return LaboratorioService(db).actualizar(idExamen, data)


@router.delete("/{idExamen}", status_code=status.HTTP_200_OK)
def cancelar_examen(idExamen: int, db: Session = Depends(get_db),
                    _: User = Depends(require_roles("administrador", "veterinario"))):
    LaboratorioService(db).cancelar(idExamen)
    return {"mensaje": f"Examen {idExamen} cancelado correctamente."}
