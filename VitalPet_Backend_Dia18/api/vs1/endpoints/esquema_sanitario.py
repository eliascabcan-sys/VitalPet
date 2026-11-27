from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_active_user
from models.user import User
from schemas.esquema_sanitario import EsquemaSanitarioOut
from service.esquema_sanitario import EsquemaSanitarioService

router = APIRouter()


@router.get("/mias", response_model=list[EsquemaSanitarioOut])
def esquema_de_mis_mascotas(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Esquema de vacunas, desparasitaciones y antipulgas de cada mascota del dueño."""
    return EsquemaSanitarioService(db).del_dueno(current_user)


@router.get("/mascota/{idMascota}", response_model=EsquemaSanitarioOut)
def esquema_de_la_mascota(idMascota: int, db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_active_user)):
    """Qué le toca a la mascota, qué está al día y qué está atrasado."""
    return EsquemaSanitarioService(db).por_mascota(idMascota, current_user)
