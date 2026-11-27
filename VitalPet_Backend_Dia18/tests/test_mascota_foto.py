"""Pruebas de la validacion y el almacenamiento de fotos de mascota (sin base de datos)."""
import base64

import pytest

from core import imagenes


def _data_url(datos: bytes) -> str:
    return "data:image/jpeg;base64," + base64.b64encode(datos).decode()


JPEG_OK = b"\xff\xd8\xff\xe0" + b"\x00" * 300 + b"\xff\xd9"


def test_acepta_jpeg_valido():
    assert imagenes.decodificar_jpeg_base64(_data_url(JPEG_OK)) == JPEG_OK


@pytest.mark.parametrize("entrada", [
    "",
    "hola",
    "data:image/png;base64," + base64.b64encode(JPEG_OK).decode(),
    "data:image/jpeg;base64,esto no es base64!!",
    _data_url(b"GIF89a" + b"\x00" * 300),                 # no es JPEG
    _data_url(b"\xff\xd8\xff\xe0" + b"\x00" * 300),       # JPEG cortado (sin fin)
    _data_url(b"\xff\xd8\xff\xd9"),                       # demasiado pequeño
])
def test_rechaza_entradas_invalidas(entrada):
    with pytest.raises(imagenes.ImagenInvalida):
        imagenes.decodificar_jpeg_base64(entrada)


def test_rechaza_imagen_muy_pesada():
    grande = b"\xff\xd8\xff\xe0" + b"\x00" * (imagenes.MAX_BYTES + 10) + b"\xff\xd9"
    with pytest.raises(imagenes.ImagenInvalida):
        imagenes.decodificar_jpeg_base64(_data_url(grande))


def test_guardar_servir_y_borrar(tmp_path, monkeypatch):
    monkeypatch.setattr(imagenes, "DIRECTORIO_FOTOS", tmp_path / "mascotas")
    nombre = imagenes.guardar_archivo(JPEG_OK)
    assert imagenes.PATRON_NOMBRE.match(nombre)
    assert imagenes.ruta_archivo(nombre).read_bytes() == JPEG_OK
    imagenes.borrar_archivo(nombre)
    assert imagenes.ruta_archivo(nombre) is None


@pytest.mark.parametrize("nombre", ["../../etc/passwd", "a.jpg", "..%2F..%2Fx.jpg", "", None, "A" * 32 + ".jpg"])
def test_nombres_peligrosos_no_se_sirven(nombre, tmp_path, monkeypatch):
    monkeypatch.setattr(imagenes, "DIRECTORIO_FOTOS", tmp_path)
    assert imagenes.ruta_archivo(nombre) is None