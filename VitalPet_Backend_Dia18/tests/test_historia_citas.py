import pytest
from pydantic import ValidationError
from datetime import datetime, timedelta

from schemas.historial import HistorialCreate
from schemas.cita import CitaCreate


def test_historia_con_peso():
    datos = {
        "motivo_consulta": "Revision general",
        "diagnostico": "Buen estado de salud",
        "peso_consulta": 12.5,
        "idMascota": 1,
        "idUsuario": 1
    }

    historia = HistorialCreate(**datos)

    assert historia.peso_consulta == 12.5


def test_historia_sin_peso():
    datos = {
        "motivo_consulta": "Revision general",
        "diagnostico": "Buen estado de salud",
        "idMascota": 1,
        "idUsuario": 1
    }

    historia = HistorialCreate(**datos)

    assert historia.peso_consulta is None


def test_cita_con_datos():
    datos = {
        "fechaHora": (datetime.now() + timedelta(days=7)).replace(microsecond=0).isoformat(),
        "motivo": "Vacunacion",
        "idUsuario": 1,
        "idMascota": 1
    }

    cita = CitaCreate(**datos)

    assert cita.motivo == "Vacunacion"
    assert cita.idMascota == 1


def test_cita_sin_mascota():
    datos = {
        "fechaHora": "2026-10-15T10:00:00",
        "motivo": "Consulta",
        "idUsuario": 1
    }

    with pytest.raises(ValidationError):
        CitaCreate(**datos)
