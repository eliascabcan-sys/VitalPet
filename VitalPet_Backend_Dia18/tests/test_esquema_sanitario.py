from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from core.esquema_sanitario import Aplicacion, calcular_esquema
from models.mascota import Mascota
from models.user import User
from models.vacuna import Vacuna
from schemas.vacuna import VacunaCreate
from service.esquema_sanitario import EsquemaSanitarioService

HOY = date(2026, 10, 13)


def item(r, clave):
    return next(i for i in r["items"] if i.clave == clave)


def ap(i, nombre, fecha, prox=None):
    return Aplicacion(i, nombre, fecha, prox)


def test_cachorro_sin_aplicaciones_le_toca_a_las_8_semanas():
    nac = HOY - timedelta(weeks=7)
    r = calcular_esquema("Canino", nac, {}, HOY)
    poli = item(r, "polivalente_canina")
    assert poli.fecha_objetivo == nac + timedelta(weeks=8)
    assert poli.estado == "proxima" and poli.dias_restantes == 7


def test_adulto_sin_registros_aparece_vencido():
    r = calcular_esquema("Canino", HOY - timedelta(days=800), {}, HOY)
    assert item(r, "rabia").estado == "vencida"
    assert item(r, "desparasitacion").estado == "vencida"
    assert r["resumen"]["vencida"] >= 3


def test_serie_completa_calcula_refuerzo_anual():
    nac = HOY - timedelta(days=700)
    apps = {"vacuna": [ap(1, "Polivalente", date(2026, 3, 1))]*0 + [
        ap(1, "Polivalente DHPP", date(2025, 11, 1)), ap(2, "Polivalente DHPP", date(2025, 11, 22)),
        ap(3, "Polivalente DHPP", date(2025, 12, 13))]}
    poli = item(calcular_esquema("Canino", nac, apps, HOY), "polivalente_canina")
    assert poli.dosis_aplicadas == 3 and poli.fecha_objetivo == date(2026, 12, 13)
    assert poli.estado == "al_dia" and poli.dias_restantes == 61


def test_la_fecha_del_veterinario_manda_sobre_la_calculada():
    nac = HOY - timedelta(days=700)
    apps = {"vacuna": [ap(1, "Antirrábica", date(2026, 1, 10), prox=date(2027, 3, 1))]}
    rabia = item(calcular_esquema("Canino", nac, apps, HOY), "rabia")
    assert rabia.fecha_objetivo == date(2027, 3, 1) and rabia.estado == "al_dia"


def test_refuerzo_vencido():
    apps = {"vacuna": [ap(1, "Rabia", date(2025, 6, 1))]}
    rabia = item(calcular_esquema("Felino", HOY - timedelta(days=900), apps, HOY), "rabia")
    assert rabia.estado == "vencida" and rabia.dias_restantes < 0


def test_serie_incompleta_respeta_intervalo_minimo():
    nac = HOY - timedelta(weeks=20)
    apps = {"vacuna": [ap(1, "Polivalente", HOY - timedelta(days=3))]}
    poli = item(calcular_esquema("Canino", nac, apps, HOY), "polivalente_canina")
    assert poli.fecha_objetivo == HOY - timedelta(days=3) + timedelta(days=14)


def test_nombres_con_tildes_y_variantes_se_reconocen():
    apps = {"vacuna": [ap(1, "Óctuple", date(2026, 5, 1)), ap(2, "Séxtuple", date(2026, 5, 22)),
                       ap(3, "Quíntuple", date(2026, 6, 12))]}
    assert item(calcular_esquema("Canino", HOY - timedelta(days=500), apps, HOY), "polivalente_canina").dosis_aplicadas == 3


def test_vacuna_opcional_sin_aplicar_no_cuenta_como_atrasada():
    r = calcular_esquema("Canino", HOY - timedelta(days=500), {}, HOY)
    assert item(r, "bordetella").estado == "opcional"


def test_sin_fecha_de_nacimiento_pide_el_dato():
    r = calcular_esquema("Canino", None, {}, HOY)
    assert item(r, "rabia").estado == "sin_datos"
    assert item(r, "desparasitacion").estado == "sin_datos"


def test_desparasitacion_cambia_de_intervalo_con_la_edad():
    cachorro = calcular_esquema("Canino", HOY - timedelta(weeks=8),
                                {"desparasitacion": [ap(1, "Pirantel", HOY - timedelta(days=5))]}, HOY)
    adulto = calcular_esquema("Canino", HOY - timedelta(days=900),
                              {"desparasitacion": [ap(1, "Pirantel", HOY - timedelta(days=5))]}, HOY)
    assert item(cachorro, "desparasitacion").fecha_objetivo == HOY - timedelta(days=5) + timedelta(days=14)
    assert item(adulto, "desparasitacion").fecha_objetivo == HOY - timedelta(days=5) + timedelta(days=90)


def test_antipulgas_mensual():
    apps = {"antipulgas": [ap(1, "Nexgard", HOY - timedelta(days=10))]}
    a = item(calcular_esquema("Felino", HOY - timedelta(days=900), apps, HOY), "antipulgas")
    assert a.fecha_objetivo == HOY + timedelta(days=20) and a.estado == "proxima"


def test_especie_sin_esquema_estandar():
    r = calcular_esquema("Roedor", HOY - timedelta(days=300), {}, HOY)
    assert r["tiene_esquema"] is False
    assert [i.clave for i in r["items"]] == ["desparasitacion"]
    assert "veterinario" in r["nota"]


# ---------- con base de datos ----------

@pytest.fixture
def escenario(db):
    d = User(nombre="Ana", apellido="Ruiz", email="a@t.com", contrasena="x", rol="dueno")
    o = User(nombre="Beto", apellido="Gil", email="b@t.com", contrasena="x", rol="dueno")
    v = User(nombre="Vera", apellido="Vet", email="v@t.com", contrasena="x", rol="veterinario")
    db.add_all([d, o, v]); db.flush()
    m = Mascota(nombre_mascota="Luna", especie="Canino", idUsuario=d.idUsuario, fechaNacimiento=HOY - timedelta(days=400))
    db.add(m); db.commit()
    return d, o, v, m


def test_el_servicio_lee_los_tres_tipos_y_ignora_inactivas(db, escenario):
    d, _, _, m = escenario
    db.add_all([
        Vacuna(nombre_vacuna="Antirrábica", fecha_aplicacion=HOY - timedelta(days=30), idMascota=m.idMascota),
        Vacuna(nombre_vacuna="Pirantel", tipo="desparasitacion", fecha_aplicacion=HOY - timedelta(days=20), idMascota=m.idMascota),
        Vacuna(nombre_vacuna="Nexgard", tipo="antipulgas", fecha_aplicacion=HOY - timedelta(days=5), idMascota=m.idMascota),
        Vacuna(nombre_vacuna="Rabia vieja", fecha_aplicacion=HOY - timedelta(days=900), estado="inactivo", idMascota=m.idMascota),
    ]); db.commit()
    r = EsquemaSanitarioService(db).de_mascota(m, HOY)
    por = {i["clave"]: i for i in r["items"]}
    assert por["rabia"]["dosis_aplicadas"] == 1
    assert por["desparasitacion"]["dosis_aplicadas"] == 1 and por["antipulgas"]["dosis_aplicadas"] == 1


def test_dueno_solo_ve_el_esquema_de_su_mascota(db, escenario):
    d, o, v, m = escenario
    srv = EsquemaSanitarioService(db)
    assert srv.por_mascota(m.idMascota, d)["nombre_mascota"] == "Luna"
    assert srv.por_mascota(m.idMascota, v)["idMascota"] == m.idMascota
    with pytest.raises(HTTPException) as e:
        srv.por_mascota(m.idMascota, o)
    assert e.value.status_code == 403
    assert srv.del_dueno(o) == [] and len(srv.del_dueno(d)) == 1


def test_el_tipo_de_aplicacion_se_valida():
    base = dict(nombre_vacuna="Pirantel", fecha_aplicacion=HOY, idMascota=1)
    assert VacunaCreate(**base).tipo == "vacuna"
    assert VacunaCreate(**base, tipo="antipulgas").tipo == "antipulgas"
    with pytest.raises(ValidationError):
        VacunaCreate(**base, tipo="otra")
