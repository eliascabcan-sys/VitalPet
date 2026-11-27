import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.limitador import LimitadorPorIP
from core.security import get_current_active_user, require_roles
from models.user import User
from schemas.certificado import (
    CertificadoAnular, CertificadoCreate, CertificadoOut, FirmaEstado, FirmaIn, VerificacionOut,
)
from service.certificado import CertificadoService

router = APIRouter()
_limitador_verificacion = LimitadorPorIP(maximo=20, ventana_segundos=60)

# Nota: NO existe PUT/PATCH/DELETE para editar o borrar un certificado emitido.
# Lo único posible después de emitir es anularlo (PUT /{id}/anular).


@router.post("/", response_model=CertificadoOut, status_code=status.HTTP_201_CREATED)
def emitir_certificado(
    data: CertificadoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrador", "veterinario")),
):
    """Emite un certificado firmado por el veterinario que lo pide (queda congelado)."""
    return CertificadoService(db).emitir(data, current_user)


@router.get("/verificar/{codigo}", response_model=VerificacionOut)
def verificar_certificado(codigo: str, request: Request, db: Session = Depends(get_db)):
    """PÚBLICO (sin sesión): comprueba si un certificado es auténtico, está vigente o fue anulado.
    No devuelve el contenido ni los datos del propietario. Limitado a 20 consultas por minuto por IP."""
    ip = request.client.host if request.client else "desconocida"
    if not _limitador_verificacion.permitir(ip):
        raise HTTPException(status_code=429, detail="Demasiadas consultas. Espera un minuto e inténtalo de nuevo.")
    return CertificadoService(db).verificar_publico(codigo)


@router.get("/firma", response_model=FirmaEstado)
def mi_firma(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrador", "veterinario")),
):
    """¿El veterinario ya registró la imagen de su firma?"""
    return CertificadoService(db).firma_de(current_user)


@router.put("/firma", response_model=FirmaEstado)
def guardar_mi_firma(
    data: FirmaIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrador", "veterinario")),
):
    """Guarda la imagen de la firma del veterinario (se estampa en los certificados nuevos)."""
    return CertificadoService(db).guardar_firma(current_user, data.firma)


@router.get("/mascota/{idMascota}", response_model=list[CertificadoOut])
def certificados_de_la_mascota(
    idMascota: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return CertificadoService(db).por_mascota(idMascota, current_user)


@router.get("/{idCertificado}", response_model=CertificadoOut)
def obtener_certificado(
    idCertificado: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return CertificadoService(db).obtener(idCertificado, current_user)


@router.get("/{idCertificado}/pdf")
def pdf_del_certificado(
    idCertificado: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """PDF A4 del certificado, con QR de verificación. El dueño solo descarga los suyos."""
    contenido, nombre = CertificadoService(db).pdf(
        idCertificado, current_user, os.getenv("FRONTEND_URL", "http://localhost:5173"))
    return Response(content=contenido, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{nombre}"'})


@router.put("/{idCertificado}/anular", response_model=CertificadoOut)
def anular_certificado(
    idCertificado: int,
    data: CertificadoAnular,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("administrador", "veterinario")),
):
    return CertificadoService(db).anular(idCertificado, data.motivo, current_user)