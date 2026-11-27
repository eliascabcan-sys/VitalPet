from fastapi import APIRouter, Depends

from core.security import get_current_active_user
from core.triaje import NIVELES
from models.user import User
from schemas.triaje import NivelTriajeOut

router = APIRouter()


@router.get("/niveles", response_model=list[NivelTriajeOut])
def listar_niveles(_: User = Depends(get_current_active_user)):
    """Los 5 niveles de triaje, de mas a menos urgente. Lo leen las paginas de triaje."""
    return list(NIVELES)