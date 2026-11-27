"""Fotos de mascotas: validacion y almacenamiento de archivos.

Sin dependencias externas (no usa Pillow). El navegador ya recorta y reduce la
foto a 400x400 JPEG antes de enviarla; aqui solo se comprueba que lo recibido
sea de verdad un JPEG razonable y se guarda con un nombre aleatorio.
"""
import base64
import binascii
import os
import re
import uuid
from pathlib import Path

MAX_BYTES = 1_500_000  # 1,5 MB; una foto recortada pesa ~40-80 KB
_PATRON_DATA_URL = re.compile(r"^data:image/jpeg;base64,(.+)$", re.DOTALL)
PATRON_NOMBRE = re.compile(r"^[a-f0-9]{32}\.jpg$")

# Carpeta de fotos. Se puede cambiar con UPLOADS_DIR en el .env.
DIRECTORIO_FOTOS = Path(
    os.getenv("UPLOADS_DIR") or Path(__file__).resolve().parent.parent / "uploads"
) / "mascotas"


class ImagenInvalida(ValueError):
    """La imagen recibida no cumple las reglas; el mensaje es apto para el usuario."""


def decodificar_jpeg_base64(data_url: str) -> bytes:
    coincidencia = _PATRON_DATA_URL.match(data_url or "")
    if not coincidencia:
        raise ImagenInvalida("La foto debe ser una imagen JPEG.")
    try:
        datos = base64.b64decode(coincidencia.group(1), validate=True)
    except (binascii.Error, ValueError):
        raise ImagenInvalida("La imagen llegó dañada o incompleta. Intenta de nuevo.")
    if len(datos) > MAX_BYTES:
        raise ImagenInvalida("La foto pesa demasiado (máximo 1,5 MB).")
    if len(datos) < 200 or not datos.startswith(b"\xff\xd8\xff") or not datos.rstrip(b"\x00").endswith(b"\xff\xd9"):
        raise ImagenInvalida("El archivo no es una imagen JPEG válida.")
    return datos


def guardar_archivo(datos: bytes) -> str:
    DIRECTORIO_FOTOS.mkdir(parents=True, exist_ok=True)
    nombre = f"{uuid.uuid4().hex}.jpg"
    (DIRECTORIO_FOTOS / nombre).write_bytes(datos)
    return nombre


def ruta_archivo(nombre: str):
    """Ruta del archivo, o None si el nombre no es valido o no existe."""
    if not nombre or not PATRON_NOMBRE.match(nombre):
        return None
    ruta = DIRECTORIO_FOTOS / nombre
    return ruta if ruta.is_file() else None


def borrar_archivo(nombre) -> None:
    ruta = ruta_archivo(nombre) if nombre else None
    if ruta:
        try:
            ruta.unlink()
        except OSError:
            pass