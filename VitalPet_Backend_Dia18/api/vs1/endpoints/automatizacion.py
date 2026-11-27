from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_roles
from models.user import User
from service.automatizacion import ejecutar_ciclo

router = APIRouter()


@router.post("/ejecutar")
def ejecutar_automatizacion(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("administrador", "veterinario")),
):
    """
    Dispara manualmente el mismo ciclo que corre solo cada N minutos
    (envíos de preguntas, reintentos/vencimiento y reescalado de alertas).
    Pensado para demos: no hay que esperar el intervalo real.
    """
    return ejecutar_ciclo(db)
