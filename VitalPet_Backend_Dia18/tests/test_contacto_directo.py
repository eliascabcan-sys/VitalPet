"""Día 12 · P2: contacto directo cuando la respuesta de seguimiento es muy mala (alerta roja)."""
from datetime import datetime, timedelta, timezone

import pytest

from models.acudiente import Acudiente
from models.alerta_seguimiento import AlertaSeguimiento
from models.consentimiento import Consentimiento
from models.historial import HistorialClinico
from models.mascota import Mascota
from models.plantilla_seguimiento import PlantillaSeguimiento
from models.pregunta_plantilla import PreguntaPlantilla
from models.respuesta_seguimiento import RespuestaSeguimiento
from models.seguimiento import Seguimiento


@pytest.fixture
def escenario(db, api):
    dueno, vet = api.usuarios["dueno"], api.usuarios["veterinario"]
    dueno.telefono = "3001234567"
    mascota = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=dueno.idUsuario)
    db.add(mascota); db.flush()
    h = HistorialClinico(idMascota=mascota.idMascota, idUsuario=vet.idUsuario)
    pl = PlantillaSeguimiento(nombre="Seguimiento vómito", tipo_animal="Canino", diagnostico="Vómito")
    db.add_all([h, pl]); db.flush()
    preg = PreguntaPlantilla(idPlantilla=pl.idPlantilla, texto_pregunta="¿Ha vomitado nuevamente?",
                             dias_desde_diagnostico=1, orden=1, nivel_alerta_si_mal="rojo")
    seg = Seguimiento(idHistorial=h.idHistorial, idPlantilla=pl.idPlantilla)
    db.add_all([preg, seg]); db.flush()

    def alerta(nivel, respuesta="Varias veces", hace_min=0):
        r = RespuestaSeguimiento(idSeguimiento=seg.idSeguimiento, idPregunta=preg.idPregunta,
                                 fecha_programada=datetime.now(), estado_envio="respondida", respuesta=respuesta)
        db.add(r); db.flush()
        a = AlertaSeguimiento(idSeguimiento=seg.idSeguimiento, idRespuesta=r.idRespuesta, nivel=nivel,
                              fecha_generada=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=hace_min))
        db.add(a); db.commit()
        return a

    return dict(alerta=alerta, mascota=mascota, dueno=dueno)


def test_solo_las_alertas_rojas_sin_contactar_aparecen(api, escenario):
    roja = escenario["alerta"]("rojo", hace_min=30)
    escenario["alerta"]("naranja")
    escenario["alerta"]("amarillo")
    r = api.get("/contacto-directo/pendientes", rol="veterinario")
    assert r.status_code == 200
    filas = r.json()
    assert [f["idAlerta"] for f in filas] == [roja.idAlerta]
    f = filas[0]
    assert f["nombre_mascota"] == "Luna" and f["nombre_dueno"].startswith("Dueno")
    assert f["telefono_dueno"] == "3001234567" and f["respuesta"] == "Varias veces"
    assert f["pregunta"] == "¿Ha vomitado nuevamente?" and f["minutos_espera"] >= 29


def test_la_mas_antigua_va_primero(api, escenario):
    nueva = escenario["alerta"]("rojo", hace_min=5)
    vieja = escenario["alerta"]("rojo", hace_min=90)
    ids = [f["idAlerta"] for f in api.get("/contacto-directo/pendientes", rol="administrador").json()]
    assert ids == [vieja.idAlerta, nueva.idAlerta]


def test_si_hay_consentimiento_aparece_el_acudiente(db, api, escenario):
    dueno = escenario["dueno"]
    ac = Acudiente(idUsuario=dueno.idUsuario, nombre="Rosa", apellido="Pérez", telefono="3109998877",
                   parentesco="Hija", autorizado=True)
    db.add(ac); db.flush()
    db.add(Consentimiento(idUsuario=dueno.idUsuario, idAcudiente=ac.idAcudiente, vigente=True)); db.commit()
    escenario["alerta"]("rojo")
    f = api.get("/contacto-directo/pendientes", rol="veterinario").json()[0]
    assert f["acudiente"] == {"nombre": "Rosa Pérez", "telefono": "3109998877", "parentesco": "Hija"}


def test_registrar_contacto_la_saca_de_la_lista(api, escenario, db):
    a = escenario["alerta"]("rojo")
    r = api.put(f"/contacto-directo/{a.idAlerta}", rol="veterinario",
                json={"canal": "llamada", "nota": "Se le indicó traerla hoy."})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["canal_contacto"] == "llamada" and cuerpo["estado"] == "vista"
    assert cuerpo["contactado_por"] == api.usuarios["veterinario"].idUsuario
    assert api.get("/contacto-directo/pendientes", rol="veterinario").json() == []
    db.expire_all()
    guardada = db.get(AlertaSeguimiento, a.idAlerta)
    assert guardada.fecha_contacto is not None and guardada.notificado_veterinario is True


def test_no_se_puede_contactar_dos_veces(api, escenario):
    a = escenario["alerta"]("rojo")
    assert api.put(f"/contacto-directo/{a.idAlerta}", rol="administrador", json={"canal": "correo"}).status_code == 200
    assert api.put(f"/contacto-directo/{a.idAlerta}", rol="veterinario", json={"canal": "llamada"}).status_code == 409


def test_solo_alertas_graves_piden_contacto_y_debe_existir(api, escenario):
    naranja = escenario["alerta"]("naranja")
    assert api.put(f"/contacto-directo/{naranja.idAlerta}", rol="veterinario", json={"canal": "llamada"}).status_code == 400
    assert api.put("/contacto-directo/9999", rol="veterinario", json={"canal": "llamada"}).status_code == 404


def test_canal_invalido_y_html_en_la_nota_se_rechazan(api, escenario):
    a = escenario["alerta"]("rojo")
    assert api.put(f"/contacto-directo/{a.idAlerta}", rol="veterinario", json={"canal": "paloma"}).status_code == 422
    assert api.put(f"/contacto-directo/{a.idAlerta}", rol="veterinario",
                   json={"canal": "llamada", "nota": "<script>x</script>"}).status_code == 422


def test_el_dueno_no_puede_ver_ni_registrar_contactos(api, escenario):
    a = escenario["alerta"]("rojo")
    assert api.get("/contacto-directo/pendientes", rol="dueno").status_code == 403
    assert api.put(f"/contacto-directo/{a.idAlerta}", rol="dueno", json={"canal": "llamada"}).status_code == 403
    assert api.get("/contacto-directo/pendientes").status_code == 401