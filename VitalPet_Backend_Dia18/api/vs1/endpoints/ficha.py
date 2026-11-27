from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_roles
from models.user import User
from schemas.ficha import FichaPacienteOut
from service.ficha import FichaService

router = APIRouter()


@router.get("/mascota/{idMascota}", response_model=FichaPacienteOut)
def ficha_del_paciente(
    idMascota: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrador", "veterinario")),
):
    """
    Ficha completa del paciente: datos, dueño, controles (anamnesis y examen), fórmulas,
    laboratorio, vacunas / desparasitación / antipulgas, inyecciones, compras, citas,
    certificados y evolución del peso. Solo personal de la clínica.
    """
    return FichaService(db).de_mascota(idMascota, current_user)
