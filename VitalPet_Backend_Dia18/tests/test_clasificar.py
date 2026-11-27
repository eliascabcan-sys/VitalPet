import itertools

import pytest

from core.triaje import CODIGOS, genera_alerta
from service.reporte_salud import ReporteSaludService

clasificar = ReporteSaludService.clasificar

# Opciones reales del formulario (DuenoReportePage.tsx)
COMIDA = ["Sí, normal", "Poco", "No comió"]
ACTIVIDAD = ["Muy activa", "Normal", "Decaída", "Sin energía"]
SINTOMAS = ["Ninguno", "Vómito", "Diarrea", "Tos", "Otro"]


@pytest.mark.parametrize(
    "alimentacion, actividad, sintomas, esperado",
    [
        ("No comió", "Sin energía", "Ninguno", "rojo"),
        ("No comió", "Sin energía", "Vómito", "rojo"),      # rojo gana sobre naranja
        ("Sí, normal", "Decaída", "Ninguno", "naranja"),
        ("Sí, normal", "Normal", "Vómito", "naranja"),
        ("Sí, normal", "Normal", "Diarrea", "naranja"),
        ("Poco", "Normal", "Ninguno", "amarillo"),
        ("Sí, normal", "Normal", "Otro", "amarillo"),
        ("Sí, normal", "Normal", "Tos", "verde"),
        ("Sí, normal", "Muy activa", "Ninguno", "verde"),
        ("Sí, normal", "Normal", "Ninguno", "azul"),
    ],
)
def test_clasificar_cada_nivel(alimentacion, actividad, sintomas, esperado):
    assert clasificar(alimentacion, actividad, sintomas) == esperado


def test_azul_solo_si_todo_esta_normal():
    for comida, actividad, sintoma in itertools.product(COMIDA, ACTIVIDAD, SINTOMAS):
        nivel = clasificar(comida, actividad, sintoma)
        assert nivel in CODIGOS
        todo_normal = (comida, actividad, sintoma) == ("Sí, normal", "Normal", "Ninguno")
        assert (nivel == "azul") == todo_normal


def test_azul_no_genera_alerta_y_los_demas_si():
    assert genera_alerta(clasificar("Sí, normal", "Normal", "Ninguno")) is False
    assert genera_alerta(clasificar("Poco", "Normal", "Ninguno")) is True
    assert genera_alerta(clasificar("Sí, normal", "Normal", "Tos")) is True


def test_ignora_mayusculas_y_espacios():
    assert clasificar("  SÍ, NORMAL ", " normal", "NINGUNO  ") == "azul"
    assert clasificar("no comió", "SIN ENERGÍA", "ninguno") == "rojo"


def test_valor_desconocido_no_se_toma_como_normal():
    # Si llega algo raro no debe quedar en azul (que no genera alerta)
    assert clasificar("Sí, normal", "Normal", "Cojea") == "verde"