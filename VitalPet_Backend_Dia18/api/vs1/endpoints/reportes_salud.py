from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.reporte_salud import ReporteSaludCreate, ReporteSaludOut
from service.reporte_salud import ReporteSaludService

router = APIRouter()


@router.post("/", response_model=ReporteSaludOut, status_code=status.HTTP_201_CREATED)
def crear_reporte(
    data: ReporteSaludCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("dueno")),
):
    return ReporteSaludService(db).crear(data, current_user.idUsuario)


@router.get("/mias", response_model=list[ReporteSaludOut])
def mis_reportes(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("dueno")),
):
    return ReporteSaludService(db).mios(current_user.idUsuario)


@router.get("/pendientes", response_model=list[ReporteSaludOut])
def reportes_pendientes(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario")),
):
    return ReporteSaludService(db).pendientes()


@router.put("/{idReporte}/revisar", response_model=ReporteSaludOut)
def revisar_reporte(
    idReporte: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario")),
):
    return ReporteSaludService(db).revisar(idReporte)
