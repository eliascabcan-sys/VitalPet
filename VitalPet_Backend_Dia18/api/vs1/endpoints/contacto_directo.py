from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_roles
from models.user import User
from schemas.contacto_directo import ContactoPendienteOut, ContactoRegistrar, ContactoRegistradoOut
from service.contacto_directo import ContactoDirectoService

router = APIRouter()


@router.get("/pendientes", response_model=list[ContactoPendienteOut])
def contactos_pendientes(db: Session = Depends(get_db),
                         _: User = Depends(require_roles("administrador", "veterinario"))):
    """Alertas graves (respuesta de seguimiento muy mala) que nadie ha contactado todavía."""
    return ContactoDirectoService(db).pendientes()


@router.put("/{idAlerta}", response_model=ContactoRegistradoOut)
def registrar_contacto(idAlerta: int, datos: ContactoRegistrar, db: Session = Depends(get_db),
                       usuario: User = Depends(require_roles("administrador", "veterinario"))):
    """Anota que ya se contactó al dueño: quién, por qué canal y qué se habló."""
    return ContactoDirectoService(db).registrar(idAlerta, usuario, datos)