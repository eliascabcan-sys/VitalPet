"""Foto de la mascota: subir, quitar y servir.

Se incluye con el mismo prefijo /mascotas que el router de mascotas.
Permisos: el dueño solo cambia la foto de SUS mascotas; veterinario y
administrador, la de cualquiera.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.database import get_db
from core.imagenes import (
    ImagenInvalida,
    borrar_archivo,
    decodificar_jpeg_base64,
    guardar_archivo,
    ruta_archivo,
)
from core.security import get_current_active_user
from models.user import User
from schemas.mascota import MascotaOut
from service.mascota import MascotaService

logger = logging.getLogger(__name__)
router = APIRouter()


class FotoIn(BaseModel):
    # data URL "data:image/jpeg;base64,...." generada por el recortador del frontend
    imagen: str = Field(..., max_length=2_200_000)


def _mascota_con_permiso(db: Session, id: int, usuario: User):
    mascota = MascotaService(db).get_by_id(id)
    if usuario.rol == "dueno" and mascota.idUsuario != usuario.idUsuario:
        raise HTTPException(status_code=403, detail="No puedes cambiar la foto de una mascota que no te pertenece.")
    return mascota


def _guardar_nombre(db: Session, mascota, nombre_nuevo):
    anterior = mascota.foto
    mascota.foto = nombre_nuevo
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("No se pudo guardar la foto de la mascota %s", mascota.idMascota)
        borrar_archivo(nombre_nuevo)
        raise HTTPException(status_code=500, detail="No se pudo guardar la foto. Intenta de nuevo.")
    db.refresh(mascota)
    borrar_archivo(anterior)
    return mascota


@router.get("/foto/{nombre}")
def ver_foto(nombre: str):
    # Publico a proposito: una etiqueta <img> no puede mandar el token. El nombre es
    # un UUID aleatorio (no se puede adivinar) y solo se sirven archivos de esta carpeta.
    ruta = ruta_archivo(nombre)
    if ruta is None:
        raise HTTPException(status_code=404, detail="Foto no encontrada.")
    return FileResponse(
        ruta,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.put("/{id}/foto", response_model=MascotaOut)
def subir_foto(
    id: int,
    datos: FotoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    mascota = _mascota_con_permiso(db, id, current_user)
    try:
        contenido = decodificar_jpeg_base64(datos.imagen)
    except ImagenInvalida as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return _guardar_nombre(db, mascota, guardar_archivo(contenido))


@router.delete("/{id}/foto", response_model=MascotaOut)
def quitar_foto(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    mascota = _mascota_con_permiso(db, id, current_user)
    return _guardar_nombre(db, mascota, None)