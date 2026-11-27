from datetime import datetime, timedelta

import pytest

from core.triaje import CODIGOS_ALERTA, subir_nivel
from models.alerta_seguimiento import AlertaSeguimiento
from service.triaje import reescalar_alertas

AHORA = datetime(2026, 1, 1, 12, 0)


def crear_alerta(db, nivel, hace_min, vista=False, fecha_nivel=True):
    """Crea una alerta cuyo nivel actual empezo hace `hace_min` minutos."""
    desde = AHORA - timedelta(minutes=hace_min)
    alerta = AlertaSeguimiento(
        idSeguimiento=1,
        idRespuesta=1,
        nivel=nivel,
        fecha_generada=desde,
        fecha_nivel=desde if fecha_nivel else None,
        notificado_veterinario=vista,
    )
    db.add(alerta)
    db.commit()
    return alerta


# ---------- core/triaje.subir_nivel ----------

def test_subir_nivel_recorre_la_escala():
    assert subir_nivel("azul") == "verde"
    assert subir_nivel("verde") == "amarillo"
    assert subir_nivel("amarillo") == "naranja"
    assert subir_nivel("naranja") == "rojo"


def test_subir_nivel_rojo_se_queda_en_rojo():
    assert subir_nivel("rojo") == "rojo"


def test_subir_nivel_desconocido_da_error():
    with pytest.raises(ValueError):
        subir_nivel("morado")


def test_azul_no_es_nivel_de_alerta():
    assert "azul" not in CODIGOS_ALERTA
    assert len(CODIGOS_ALERTA) == 4


# ---------- reescalar_alertas ----------

def test_sube_un_nivel_cuando_paso_el_tiempo_objetivo(db):
    alerta = crear_alerta(db, "verde", hace_min=121)   # verde = 120 min

    subidas = reescalar_alertas(db, ahora=AHORA)

    assert subidas == [alerta]
    db.refresh(alerta)
    assert alerta.nivel == "amarillo"
    assert alerta.nivel_original == "verde"
    assert alerta.veces_reescalada == 1
    assert alerta.fecha_nivel == AHORA          # el tiempo se reinicia


def test_no_sube_antes_ni_justo_en_el_tiempo_objetivo(db):
    antes = crear_alerta(db, "verde", hace_min=119)
    justo = crear_alerta(db, "verde", hace_min=120)

    assert reescalar_alertas(db, ahora=AHORA) == []
    db.refresh(antes)
    db.refresh(justo)
    assert antes.nivel == "verde"
    assert justo.nivel == "verde"


@pytest.mark.parametrize("nivel, minutos, esperado", [
    ("verde", 121, "amarillo"),
    ("amarillo", 61, "naranja"),
    ("naranja", 11, "rojo"),
])
def test_cada_nivel_usa_su_propio_tiempo(db, nivel, minutos, esperado):
    alerta = crear_alerta(db, nivel, hace_min=minutos)
    reescalar_alertas(db, ahora=AHORA)
    db.refresh(alerta)
    assert alerta.nivel == esperado


def test_rojo_no_sube_mas(db):
    alerta = crear_alerta(db, "rojo", hace_min=5000)

    assert reescalar_alertas(db, ahora=AHORA) == []
    db.refresh(alerta)
    assert alerta.nivel == "rojo"
    assert alerta.veces_reescalada == 0


def test_alerta_ya_vista_no_se_toca(db):
    alerta = crear_alerta(db, "verde", hace_min=5000, vista=True)

    assert reescalar_alertas(db, ahora=AHORA) == []
    db.refresh(alerta)
    assert alerta.nivel == "verde"


def test_sube_solo_un_nivel_por_llamada(db):
    alerta = crear_alerta(db, "verde", hace_min=5000)

    reescalar_alertas(db, ahora=AHORA)
    db.refresh(alerta)
    assert alerta.nivel == "amarillo"            # no salta a rojo

    # Segunda llamada en el mismo instante: el tiempo se reinicio, no sube
    assert reescalar_alertas(db, ahora=AHORA) == []
    db.refresh(alerta)
    assert alerta.nivel == "amarillo"


def test_sigue_subiendo_con_el_tiempo_del_nuevo_nivel(db):
    alerta = crear_alerta(db, "verde", hace_min=121)
    reescalar_alertas(db, ahora=AHORA)                       # verde -> amarillo

    reescalar_alertas(db, ahora=AHORA + timedelta(minutes=59))
    db.refresh(alerta)
    assert alerta.nivel == "amarillo"                        # amarillo = 60 min

    reescalar_alertas(db, ahora=AHORA + timedelta(minutes=61))
    db.refresh(alerta)
    assert alerta.nivel == "naranja"
    assert alerta.veces_reescalada == 2
    assert alerta.nivel_original == "verde"


def test_alerta_antigua_sin_fecha_nivel_usa_fecha_generada(db):
    alerta = crear_alerta(db, "amarillo", hace_min=90, fecha_nivel=False)

    reescalar_alertas(db, ahora=AHORA)
    db.refresh(alerta)
    assert alerta.nivel == "naranja"
    assert alerta.nivel_original == "amarillo"


def test_nivel_desconocido_se_ignora(db):
    alerta = crear_alerta(db, "morado", hace_min=5000)

    assert reescalar_alertas(db, ahora=AHORA) == []
    db.refresh(alerta)
    assert alerta.nivel == "morado"